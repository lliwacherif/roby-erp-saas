// @ts-nocheck — Deno Edge Function, uses URL imports not resolvable by project tsconfig
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey)

        // 1. Verify Caller is Root
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders })
        }

        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('is_root')
            .eq('user_id', user.id)
            .single()

        if (!profile || !profile.is_root) {
            return new Response(JSON.stringify({ error: 'Forbidden: Root access required' }), { status: 403, headers: corsHeaders })
        }

        // 2. Parse Body
        const { tenantName, tenantSlug, adminEmail, adminPassword } = await req.json()

        if (!tenantName || !tenantSlug || !adminEmail || !adminPassword) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders })
        }

        // 3. Create Tenant
        const { data: tenant, error: tenantError } = await supabaseClient
            .from('tenants')
            .insert({
                name: tenantName,
                slug: tenantSlug,
                created_by: user.id
            })
            .select()
            .single()

        if (tenantError) {
            return new Response(JSON.stringify({ error: `Tenant creation failed: ${tenantError.message}` }), { status: 409, headers: corsHeaders })
        }

        // 4. Create Admin User
        const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true // Auto-confirm for immediate login
        })

        if (authError || !authData.user) {
            // Cleanup Tenant
            await supabaseClient.from('tenants').delete().eq('id', tenant.id)
            return new Response(JSON.stringify({ error: `User creation failed: ${authError?.message}` }), { status: 409, headers: corsHeaders })
        }

        const newUserId = authData.user.id

        // 5. Link in tenant_members
        const { error: memberError } = await supabaseClient
            .from('tenant_members')
            .insert({
                tenant_id: tenant.id,
                user_id: newUserId,
                role: 'admin'
            })

        if (memberError) {
            // Cleanup User and Tenant
            await supabaseClient.auth.admin.deleteUser(newUserId)
            await supabaseClient.from('tenants').delete().eq('id', tenant.id)
            return new Response(JSON.stringify({ error: `Membership linking failed: ${memberError.message}` }), { status: 500, headers: corsHeaders })
        }

        return new Response(
            JSON.stringify({
                tenantId: tenant.id,
                tenantSlug: tenant.slug,
                adminUserId: newUserId,
                adminEmail: adminEmail
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
