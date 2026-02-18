// @ts-nocheck — Deno Edge Function, uses URL imports not resolvable by project tsconfig
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user: caller },
      error: callerError,
    } = await supabase.auth.getUser(token)

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("is_root")
      .eq("user_id", caller.id)
      .single()

    if (!callerProfile?.is_root) {
      return new Response(JSON.stringify({ error: "Forbidden: Root access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { tenantId, email, password, fullName, role } = await req.json()
    const targetRole = role === "admin" ? "admin" : "user"

    if (!tenantId || !email || !password) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .single()

    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || null,
      },
    })

    if (createError || !authData.user) {
      return new Response(JSON.stringify({ error: createError?.message || "Failed to create user" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const userId = authData.user.id

    if (fullName && String(fullName).trim().length > 0) {
      await supabase
        .from("profiles")
        .update({ full_name: String(fullName).trim() })
        .eq("user_id", userId)
    }

    const { error: memberError } = await supabase
      .from("tenant_members")
      .insert({ tenant_id: tenantId, user_id: userId, role: targetRole })

    if (memberError) {
      await supabase.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    await supabase
      .from("user_tenant_settings")
      .upsert(
        {
          user_id: userId,
          current_tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

    return new Response(
      JSON.stringify({
        userId,
        email,
        tenantId,
        role: targetRole,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
