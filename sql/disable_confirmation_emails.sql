-- ============================================================
-- Disable confirmation emails for self-hosted Supabase Auth
-- Run in Supabase SQL Editor
-- ============================================================

DO $$
BEGIN
  -- Keep signup enabled
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'config'
      AND column_name = 'enable_signup'
  ) THEN
    UPDATE auth.config
    SET enable_signup = true;
  END IF;

  -- Auto-confirm users so no confirmation email is sent
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'config'
      AND column_name = 'mailer_autoconfirm'
  ) THEN
    UPDATE auth.config
    SET mailer_autoconfirm = true;
  END IF;
END $$;
