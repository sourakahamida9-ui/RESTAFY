-- ============================================================
-- 100 — Rate limiting backed by Supabase (no Redis required)
-- ============================================================
-- Vercel serverless n'a pas de mémoire partagée entre sandboxes.
-- Pour un rate-limit fiable côté serveur on utilise Supabase comme
-- backing store. La fonction `check_rate_limit` insère un événement
-- et retourne le nombre d'événements dans la fenêtre glissante. Si
-- ça dépasse la limite, l'appelant rejette avec 429.
--
-- Trade-off : ~30-50ms d'overhead par check (round-trip Supabase).
-- C'est acceptable pour les endpoints sensibles (paiements, formulaires
-- publics) — on ne veut pas qu'un attaquant martèle l'API GeniusPay.
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id          BIGSERIAL    PRIMARY KEY,
  bucket      TEXT         NOT NULL,        -- ex. 'payments_initiate', 'partner_join'
  identity    TEXT         NOT NULL,        -- user_id, IP, ou hash composite
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Composite index : matchera tous les SELECT du rate-limit check
-- (bucket + identity + window predicate sur created_at).
CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup
  ON rate_limit_events(bucket, identity, created_at DESC);

-- Index de cleanup : on purge tous les events > 24h (à terme).
CREATE INDEX IF NOT EXISTS idx_rate_limit_cleanup
  ON rate_limit_events(created_at);

-- ────────────────────────────────────────────────────────────
-- Fonction atomique : INSERT + COUNT en 1 round-trip.
-- Returns: { allowed: boolean, count: int, retry_after_seconds: int }
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_bucket   TEXT,
  p_identity TEXT,
  p_limit    INT,
  p_window_seconds INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_oldest_ts TIMESTAMPTZ;
  v_retry_after INT;
BEGIN
  -- 1) Compter les événements dans la fenêtre glissante AVANT l'insert.
  SELECT COUNT(*), MIN(created_at)
    INTO v_count, v_oldest_ts
  FROM rate_limit_events
  WHERE bucket = p_bucket
    AND identity = p_identity
    AND created_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  -- 2) Si déjà au-dessus du quota, refuser sans incrémenter.
  IF v_count >= p_limit THEN
    v_retry_after := GREATEST(
      1,
      EXTRACT(EPOCH FROM (v_oldest_ts + (p_window_seconds || ' seconds')::INTERVAL - NOW()))::INT
    );
    RETURN jsonb_build_object(
      'allowed', false,
      'count', v_count,
      'limit', p_limit,
      'retry_after_seconds', v_retry_after
    );
  END IF;

  -- 3) Sinon, enregistrer l'événement et autoriser.
  INSERT INTO rate_limit_events (bucket, identity) VALUES (p_bucket, p_identity);

  RETURN jsonb_build_object(
    'allowed', true,
    'count', v_count + 1,
    'limit', p_limit,
    'retry_after_seconds', 0
  );
END;
$$;

-- Service-role peut appeler la RPC ; pas exposée aux clients anon
-- (les rate limits sont enforced server-side, jamais depuis le browser).
REVOKE ALL ON FUNCTION check_rate_limit(TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT, INT, INT) TO service_role;

-- ────────────────────────────────────────────────────────────
-- Cleanup : purger les events > 24h. Appelé par le cron quotidien.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION purge_old_rate_limit_events()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM rate_limit_events WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION purge_old_rate_limit_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_old_rate_limit_events() TO service_role;

ANALYZE rate_limit_events;
