import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { Database } from '../types/db'

type Tenant = Database['public']['Tables']['tenants']['Row']

interface TenantContextType {
    currentTenant: Tenant | null
    tenants: Tenant[]
    loading: boolean
    startTransition: (tenantId: string) => Promise<void>
    role: 'admin' | 'user' | null
}

const TenantContext = createContext<TenantContextType>({
    currentTenant: null,
    tenants: [],
    loading: true,
    startTransition: async () => { },
    role: null,
})

export function TenantProvider({ children }: { children: React.ReactNode }) {
    const { user, profile, loading: authLoading } = useAuth()
    const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null)
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [loading, setLoading] = useState(true)
    const [role, setRole] = useState<'admin' | 'user' | null>(null)

    useEffect(() => {
        if (authLoading) return
        if (!user) {
            setLoading(false)
            return
        }

        fetchTenantsForUser()
    }, [user, profile, authLoading])

    const fetchTenantsForUser = async () => {
        if (!user) return
        setLoading(true)

        try {
            let availableTenants: Tenant[] = []
            let myRole: 'admin' | 'user' | null = null

            if (profile?.is_root) {
                // Root can access ALL tenants.
                const { data: allTenants, error } = await supabase.from('tenants').select('*').order('name')
                if (error) console.error('[Tenant] Root tenants fetch error:', error.message)
                availableTenants = (allTenants as Tenant[]) || []
                console.log('[Tenant] Root user, found', availableTenants.length, 'tenants')

                // Root is always admin
                myRole = 'admin'
            } else {
                // Normal user
                const { data: members, error } = await supabase
                    .from('tenant_members')
                    .select('*, tenants(*)')
                    .eq('user_id', user.id)

                if (error) {
                    console.error('[Tenant] Members fetch error:', error.message)
                    throw error
                }

                availableTenants = members?.map((m: any) => m.tenants).filter(Boolean) as Tenant[] || []
                console.log('[Tenant] Normal user, found', availableTenants.length, 'tenants')
            }

            setTenants(availableTenants)

            // Determine current tenant from settings
            const { data: settings, error: settingsError } = await supabase
                .from('user_tenant_settings')
                .select('current_tenant_id')
                .eq('user_id', user.id)
                .single()

            if (settingsError) console.log('[Tenant] Settings fetch:', settingsError.message)

            let targetTenantId = settings?.current_tenant_id
            let targetTenant = availableTenants.find(t => t.id === targetTenantId)

            if (!targetTenant && availableTenants.length > 0) {
                targetTenant = availableTenants[0]
            }

            console.log('[Tenant] Selected tenant:', targetTenant?.name || 'NONE', targetTenant?.id || '')
            setCurrentTenant(targetTenant || null)

            if (profile?.is_root) {
                setRole('admin')
            } else if (targetTenant) {
                // Get role for this tenant
                const { data: member } = await supabase
                    .from('tenant_members')
                    .select('role')
                    .eq('user_id', user.id)
                    .eq('tenant_id', targetTenant.id)
                    .single()
                setRole(member?.role || null)
            }

        } catch (e) {
            console.error('[Tenant] Error:', e)
        } finally {
            setLoading(false)
        }
    }

    const startTransition = async (tenantId: string) => {
        if (!user) return

        let target = tenants.find(t => t.id === tenantId)

        // If tenant not in local state (e.g. root user), fetch it directly
        if (!target) {
            const { data } = await supabase.from('tenants').select('*').eq('id', tenantId).single()
            if (data) {
                target = data as Tenant
                setTenants(prev => [...prev, target!])
            } else {
                return
            }
        }

        // Update settings
        await supabase.from('user_tenant_settings').upsert({
            user_id: user.id,
            current_tenant_id: tenantId,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

        // Update local state
        setCurrentTenant(target)

        if (profile?.is_root) {
            setRole('admin')
        } else {
            const { data: member } = await supabase
                .from('tenant_members')
                .select('role')
                .eq('user_id', user.id)
                .eq('tenant_id', tenantId)
                .single()
            setRole(member?.role || null)
        }
    }

    return (
        <TenantContext.Provider value={{ currentTenant, tenants, loading, startTransition, role }}>
            {children}
        </TenantContext.Provider>
    )
}

export const useTenant = () => useContext(TenantContext)
