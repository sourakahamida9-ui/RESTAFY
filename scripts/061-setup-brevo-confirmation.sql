-- Trigger pour envoyer un email de confirmation via Brevo quand un nouvel utilisateur s'inscrit
-- Cette fonction remplace l'email par défaut de Supabase

CREATE OR REPLACE FUNCTION public.handle_auth_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  confirmation_url TEXT;
  user_name TEXT;
BEGIN
  -- Récupérer le nom de l'utilisateur depuis les métadonnées
  user_name := NEW.raw_user_meta_data->>'full_name' OR NEW.email;

  -- Construire le lien de confirmation
  -- Le token est stocké dans auth.users.confirmation_token (Supabase gère cela automatiquement)
  confirmation_url := 'https://restafy.shop/auth/confirm?token=' || NEW.confirmation_token || '&email=' || urlencode(NEW.email);

  -- Appeler l'Edge Function pour envoyer l'email via Brevo
  PERFORM
    net.http_post(
      url := 'https://qvumzfcabeaognkcjyng.functions.supabase.co/send-confirmation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.jwt.claim.sub', true)
      ),
      body := jsonb_build_object(
        'email', NEW.email,
        'confirmationLink', confirmation_url,
        'userName', user_name
      )
    );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Si l'envoi échoue, on log l'erreur mais on ne bloque pas l'inscription
  RAISE WARNING '[handle_auth_confirmation_email] Erreur envoi email: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger (si applicable - Supabase gère normalement cela)
-- Note: Ce trigger s'ajoute aux mécanismes existants de Supabase
