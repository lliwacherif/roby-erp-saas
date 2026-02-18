-- ============================================================
-- CLEANUP: Remove any broken root user from previous attempt
-- Run this FIRST if the seed script was already executed
-- ============================================================

DELETE FROM auth.identities WHERE provider_id IN (
    SELECT id::text FROM auth.users WHERE email = 'root@roby.com'
);
DELETE FROM public.profiles WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'root@roby.com'
);
DELETE FROM auth.users WHERE email = 'root@roby.com';

-- ============================================================
-- CREATE ROOT USER (compatible with self-hosted Supabase)
-- ============================================================

DO $$
DECLARE
    new_user_id uuid := gen_random_uuid();
BEGIN
    -- Insert into auth.users with all required fields
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
        crypt('rootroot', gen_salt('bf')),                      -- encrypted_password (min 6 chars)
        now(),                                                 -- email_confirmed_at
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

    -- Create identity record (required for email login)
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
        new_user_id,
        new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', 'root@roby.com', 'email_verified', true),
        'email',
        new_user_id::text,
        now(),
        now(),
        now()
    );

    -- Set profile as root (the trigger should have created it)
    UPDATE public.profiles
    SET is_root = true, full_name = 'Root Admin'
    WHERE user_id = new_user_id;

    -- If trigger didn't fire, insert profile manually
    INSERT INTO public.profiles (user_id, full_name, is_root)
    VALUES (new_user_id, 'Root Admin', true)
    ON CONFLICT (user_id) DO UPDATE SET is_root = true, full_name = 'Root Admin';

    RAISE NOTICE 'Root user created with ID: %', new_user_id;
END $$;

-- ============================================================
-- DONE - Login with: root@roby.com / rootroot
-- ============================================================
