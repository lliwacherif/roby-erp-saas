-- ============================================================
-- ROBY ERP SaaS — Seed Root User
-- ============================================================
-- Run this in: Supabase > SQL Editor > New Query
--
-- This script creates (or re-creates) the root super-admin:
--   Email:    root@roby.com
--   Password: root
--
-- The root user can:
--   ✅ Create and manage tenants
--   ✅ Add/remove tenant members
--   ✅ Create new users with credentials (via root_create_tenant_user RPC)
--   ✅ Switch into any tenant ("impersonate")
--   ✅ Upload tenant logos
--   ✅ Toggle tenant status (active / on_hold)
--   ✅ Bypass ALL RLS policies (via is_root_user() function)
-- ============================================================

DO $$
DECLARE
    new_user_id uuid := gen_random_uuid();
BEGIN
    -- ──────────────────────────────────────────────
    -- 1. Clean up any previous root@roby.com user
    -- ──────────────────────────────────────────────
    -- Remove tenant memberships first (FK constraint)
    DELETE FROM public.tenant_members
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'root@roby.com');

    -- Remove user_tenant_settings
    DELETE FROM public.user_tenant_settings
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'root@roby.com');

    -- Remove identity records
    DELETE FROM auth.identities
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'root@roby.com');

    -- Remove profile
    DELETE FROM public.profiles
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'root@roby.com');

    -- Remove the auth user itself
    DELETE FROM auth.users WHERE email = 'root@roby.com';

    RAISE NOTICE '✅ Previous root@roby.com cleaned up (if existed)';

    -- ──────────────────────────────────────────────
    -- 2. Create root user in auth.users
    -- ──────────────────────────────────────────────
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        invited_at,
        confirmation_token,
        confirmation_sent_at,
        recovery_token,
        recovery_sent_at,
        email_change_token_new,
        email_change,
        email_change_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        phone,
        phone_confirmed_at,
        phone_change,
        phone_change_token,
        phone_change_sent_at,
        email_change_token_current,
        email_change_confirm_status,
        banned_until,
        reauthentication_token,
        reauthentication_sent_at,
        is_sso_user
    ) VALUES (
        new_user_id,                                          -- id
        '00000000-0000-0000-0000-000000000000',               -- instance_id
        'authenticated',                                       -- aud
        'authenticated',                                       -- role
        'root@roby.com',                                       -- email
        crypt('root', gen_salt('bf')),                         -- encrypted_password  ← PASSWORD: root
        now(),                                                 -- email_confirmed_at (auto-confirmed)
        NULL,                                                  -- invited_at
        '',                                                    -- confirmation_token
        NULL,                                                  -- confirmation_sent_at
        '',                                                    -- recovery_token
        NULL,                                                  -- recovery_sent_at
        '',                                                    -- email_change_token_new
        '',                                                    -- email_change
        NULL,                                                  -- email_change_sent_at
        NULL,                                                  -- last_sign_in_at
        '{"provider": "email", "providers": ["email"]}'::jsonb,-- raw_app_meta_data
        '{"full_name": "Root Admin"}'::jsonb,                  -- raw_user_meta_data
        FALSE,                                                 -- is_super_admin
        now(),                                                 -- created_at
        now(),                                                 -- updated_at
        NULL,                                                  -- phone
        NULL,                                                  -- phone_confirmed_at
        '',                                                    -- phone_change
        '',                                                    -- phone_change_token
        NULL,                                                  -- phone_change_sent_at
        '',                                                    -- email_change_token_current
        0,                                                     -- email_change_confirm_status
        NULL,                                                  -- banned_until
        '',                                                    -- reauthentication_token
        NULL,                                                  -- reauthentication_sent_at
        FALSE                                                  -- is_sso_user
    );

    RAISE NOTICE '✅ auth.users record created';

    -- ──────────────────────────────────────────────
    -- 3. Create identity record (required for email/password login)
    -- ──────────────────────────────────────────────
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,                                           -- id
        new_user_id,                                           -- user_id
        jsonb_build_object(
            'sub', new_user_id::text,
            'email', 'root@roby.com',
            'email_verified', true
        ),                                                     -- identity_data
        'email',                                               -- provider
        new_user_id::text,                                     -- provider_id
        now(),                                                 -- last_sign_in_at
        now(),                                                 -- created_at
        now()                                                  -- updated_at
    );

    RAISE NOTICE '✅ auth.identities record created';

    -- ──────────────────────────────────────────────
    -- 4. Create profile with is_root = TRUE
    -- ──────────────────────────────────────────────
    INSERT INTO public.profiles (user_id, full_name, is_root)
    VALUES (new_user_id, 'Root Admin', true)
    ON CONFLICT (user_id) DO UPDATE
        SET is_root = true, full_name = 'Root Admin';

    RAISE NOTICE '✅ Profile created with is_root = TRUE';

    -- ──────────────────────────────────────────────
    -- Done!
    -- ──────────────────────────────────────────────
    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════';
    RAISE NOTICE '  ROOT USER CREATED SUCCESSFULLY';
    RAISE NOTICE '  Email:    root@roby.com';
    RAISE NOTICE '  Password: root';
    RAISE NOTICE '  User ID:  %', new_user_id;
    RAISE NOTICE '══════════════════════════════════════════';
END $$;
