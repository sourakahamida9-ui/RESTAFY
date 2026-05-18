-- 014-secure-user-delete.sql
-- Fonction securisee pour la suppression d'utilisateurs par super_admin

-- 1. Fonction RPC pour supprimer un utilisateur de maniere securisee
CREATE OR REPLACE FUNCTION delete_user_secure(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  target_role TEXT;
  result JSON;
BEGIN
  -- Verifier que l'appelant est connecte
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifie');
  END IF;

  -- Recuperer le role de l'appelant
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  
  -- Verifier que l'appelant est super_admin
  IF caller_role != 'super_admin' THEN
    RETURN json_build_object('success', false, 'error', 'Acces refuse - super_admin requis');
  END IF;

  -- Recuperer le role de l'utilisateur cible
  SELECT role INTO target_role FROM profiles WHERE id = target_user_id;
  
  -- Verifier que l'utilisateur cible existe
  IF target_role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Utilisateur introuvable');
  END IF;

  -- Empecher la suppression d'un autre super_admin
  IF target_role = 'super_admin' THEN
    RETURN json_build_object('success', false, 'error', 'Impossible de supprimer un super_admin');
  END IF;

  -- Empecher l'auto-suppression
  IF target_user_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Impossible de supprimer votre propre compte');
  END IF;

  -- Anonymiser les commandes de l'utilisateur (garder l'historique)
  UPDATE orders 
  SET customer_id = NULL, 
      customer_name = 'Utilisateur supprime'
  WHERE customer_id = target_user_id;

  -- Anonymiser les reviews
  UPDATE reviews
  SET customer_id = NULL
  WHERE customer_id = target_user_id;

  -- Supprimer les notifications
  DELETE FROM notifications WHERE user_id = target_user_id;

  -- Supprimer les comptes de fidelite
  DELETE FROM loyalty_accounts WHERE customer_id = target_user_id;

  -- Supprimer les tokens push
  DELETE FROM push_tokens WHERE user_id = target_user_id;

  -- Supprimer le profil
  DELETE FROM profiles WHERE id = target_user_id;

  -- Logger l'action
  INSERT INTO email_logs (recipient, subject, type, success, error)
  VALUES (
    (SELECT email FROM auth.users WHERE id = target_user_id),
    'Compte supprime par admin',
    'user_deletion',
    true,
    json_build_object(
      'deleted_by', auth.uid(),
      'deleted_at', now(),
      'target_role', target_role
    )::text
  );

  RETURN json_build_object(
    'success', true, 
    'message', 'Utilisateur supprime avec succes',
    'deleted_user_id', target_user_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 2. Politique RLS pour permettre aux super_admin de supprimer des profils
DROP POLICY IF EXISTS "profiles_delete_superadmin" ON profiles;
CREATE POLICY "profiles_delete_superadmin" ON profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'super_admin'
    )
    AND role != 'super_admin' -- Protection: ne peut pas supprimer un super_admin
  );

-- 3. Index pour ameliorer les performances des verifications
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 4. Fonction utilitaire pour verifier si un utilisateur peut etre supprime
CREATE OR REPLACE FUNCTION can_delete_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role TEXT;
  target_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  SELECT role INTO target_role FROM profiles WHERE id = target_user_id;
  
  RETURN caller_role = 'super_admin' 
    AND target_role IS NOT NULL 
    AND target_role != 'super_admin'
    AND target_user_id != auth.uid();
END;
$$;

COMMENT ON FUNCTION delete_user_secure IS 'Supprime un utilisateur de maniere securisee. Seuls les super_admin peuvent utiliser cette fonction. Les super_admin ne peuvent pas etre supprimes.';
COMMENT ON FUNCTION can_delete_user IS 'Verifie si l utilisateur connecte peut supprimer un utilisateur cible.';
