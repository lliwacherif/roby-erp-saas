-- ============================================================
-- Root-only RPC: create tenant user without confirmation email
-- Run in Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.root_create_tenant_user(
  p_tenant_id UUID,
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'user'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_email TEXT := lower(trim(p_email));
  v_role TEXT := CASE WHEN p_role = 'admin' THEN 'admin' ELSE 'user' END;
  v_user_id UUID := extensions.gen_random_uuid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = v_caller
      AND is_root = true
  ) THEN
    RAISE EXCEPTION 'Forbidden: root access required';
  END IF;

  IF p_tenant_id IS NULL OR v_email = '' OR p_password IS NULL OR p_password = '' THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'User with this email already exists';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    CASE
      WHEN p_full_name IS NULL OR trim(p_full_name) = '' THEN '{}'::jsonb
      ELSE jsonb_build_object('full_name', trim(p_full_name))
    END,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    extensions.gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (p_tenant_id, v_user_id, v_role);

  UPDATE public.profiles
  SET full_name = CASE
    WHEN p_full_name IS NULL OR trim(p_full_name) = '' THEN full_name
    ELSE trim(p_full_name)
  END
  WHERE user_id = v_user_id;

  INSERT INTO public.user_tenant_settings (user_id, current_tenant_id, updated_at)
  VALUES (v_user_id, p_tenant_id, now())
  ON CONFLICT (user_id) DO UPDATE
  SET current_tenant_id = EXCLUDED.current_tenant_id,
      updated_at = now();

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'email', v_email,
    'tenant_id', p_tenant_id,
    'role', v_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.root_create_tenant_user(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
