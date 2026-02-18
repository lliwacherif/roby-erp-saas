import { useEffect, useState, type ChangeEvent } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/db'
import { DataTable } from '@/components/ui/DataTable'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/lib/auth'
import { useTenant } from '@/lib/tenant'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/lib/i18n'
import { Users, Trash2, Shield, User, Plus, Building } from 'lucide-react'

type Tenant = Database['public']['Tables']['tenants']['Row']

interface TenantMember {
    tenant_id: string
    user_id: string
    role: 'admin' | 'user'
    created_at: string
    email?: string
    full_name?: string | null
}

export default function TenantListPage() {
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [createLoading, setCreateLoading] = useState(false)
    const [tenantName, setTenantName] = useState('')
    const [tenantSlug, setTenantSlug] = useState('')
    const [membersModalOpen, setMembersModalOpen] = useState(false)
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
    const [members, setMembers] = useState<TenantMember[]>([])
    const [membersLoading, setMembersLoading] = useState(false)
    const [addEmail, setAddEmail] = useState('')
    const [addRole, setAddRole] = useState<'admin' | 'user'>('user')
    const [addLoading, setAddLoading] = useState(false)
    const [createUserFullName, setCreateUserFullName] = useState('')
    const [createUserEmail, setCreateUserEmail] = useState('')
    const [createUserPassword, setCreateUserPassword] = useState('')
    const [createUserRole, setCreateUserRole] = useState<'admin' | 'user'>('user')
    const [createUserLoading, setCreateUserLoading] = useState(false)
    const [memberError, setMemberError] = useState('')
    const [logoModalOpen, setLogoModalOpen] = useState(false)
    const [logoTenant, setLogoTenant] = useState<Tenant | null>(null)
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const [logoLoading, setLogoLoading] = useState(false)
    const [logoError, setLogoError] = useState('')

    const { user } = useAuth()
    const { startTransition } = useTenant()
    const navigate = useNavigate()
    const { t } = useI18n()

    useEffect(() => { fetchTenants() }, [])

    const fetchTenants = async () => {
        setLoading(true)
        const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
        if (data) setTenants(data as Tenant[])
        setLoading(false)
    }

    const handleCreateTenant = async () => {
        if (!tenantName || !tenantSlug || !user) return
        setCreateLoading(true)
        try {
            const { data: tenant, error: tenantError } = await supabase
                .from('tenants')
                .insert({ name: tenantName, slug: tenantSlug, created_by: user.id })
                .select().single()
            if (tenantError) throw new Error(tenantError.message)
            const newTenant = tenant as any
            const { error: memberError } = await supabase
                .from('tenant_members')
                .insert({ tenant_id: newTenant.id, user_id: user.id, role: 'admin' })
            if (memberError) console.warn('Membership insert warning:', memberError.message)
            resetForm()
            fetchTenants()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setCreateLoading(false)
        }
    }

    const handleImpersonate = async (tenantId: string) => {
        await startTransition(tenantId)
        navigate('/app/articles')
    }

    const resetForm = () => {
        setIsCreateOpen(false)
        setTenantName('')
        setTenantSlug('')
    }

    const openLogoModal = (tenant: Tenant) => {
        setLogoTenant(tenant)
        setLogoFile(null)
        setLogoPreview(tenant.logo_url || null)
        setLogoError('')
        setLogoModalOpen(true)
    }

    const closeLogoModal = () => {
        setLogoModalOpen(false)
        setLogoTenant(null)
        setLogoFile(null)
        setLogoPreview(null)
        setLogoError('')
    }

    const handleLogoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null
        setLogoError('')

        if (!file) {
            setLogoFile(null)
            return
        }

        if (!file.type.startsWith('image/')) {
            setLogoError(t('invalidLogoFile'))
            return
        }

        if (file.size > 2 * 1024 * 1024) {
            setLogoError(t('logoFileTooLarge'))
            return
        }

        setLogoFile(file)
        setLogoPreview(URL.createObjectURL(file))
    }

    const handleUploadLogo = async () => {
        if (!logoTenant || !logoFile) return

        setLogoLoading(true)
        setLogoError('')
        try {
            const ext = logoFile.name.includes('.') ? logoFile.name.split('.').pop() : 'png'
            const filePath = `${logoTenant.id}/${Date.now()}.${ext}`

            const { error: uploadError } = await supabase.storage
                .from('tenant-logos')
                .upload(filePath, logoFile, { upsert: true, contentType: logoFile.type })

            if (uploadError && /bucket not found/i.test(uploadError.message)) {
                throw new Error('Bucket "tenant-logos" missing. Run sql/tenant_logo_support.sql once in Supabase SQL editor.')
            }

            if (uploadError) throw uploadError

            const { data } = supabase.storage.from('tenant-logos').getPublicUrl(filePath)
            const publicUrl = data.publicUrl

            const { error: updateError } = await supabase
                .from('tenants')
                .update({ logo_url: publicUrl })
                .eq('id', logoTenant.id)

            if (updateError) throw updateError

            setLogoPreview(publicUrl)
            setLogoFile(null)
            await fetchTenants()
        } catch (err: any) {
            setLogoError(err.message || 'Logo update failed')
        } finally {
            setLogoLoading(false)
        }
    }

    const handleRemoveLogo = async () => {
        if (!logoTenant) return

        setLogoLoading(true)
        setLogoError('')
        try {
            const { error: updateError } = await supabase
                .from('tenants')
                .update({ logo_url: null })
                .eq('id', logoTenant.id)

            if (updateError) throw updateError

            setLogoPreview(null)
            setLogoFile(null)
            await fetchTenants()
        } catch (err: any) {
            setLogoError(err.message || 'Logo remove failed')
        } finally {
            setLogoLoading(false)
        }
    }

    // ─── Members ───
    const openMembersModal = async (tenant: Tenant) => {
        setSelectedTenant(tenant)
        setMembersModalOpen(true)
        setMemberError('')
        setAddEmail('')
        setAddRole('user')
        setCreateUserFullName('')
        setCreateUserEmail('')
        setCreateUserPassword('')
        setCreateUserRole('user')
        await fetchMembers(tenant.id)
    }

    const closeMembersModal = () => {
        setMembersModalOpen(false)
        setSelectedTenant(null)
        setMembers([])
        setMemberError('')
        setCreateUserFullName('')
        setCreateUserEmail('')
        setCreateUserPassword('')
    }

    const fetchMembers = async (tenantId: string) => {
        setMembersLoading(true)
        try {
            const { data: memberData, error } = await supabase
                .from('tenant_members').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: true })
            if (error) throw error
            const rawMembers = (memberData || []) as TenantMember[]
            const userIds = rawMembers.map(m => m.user_id)
            if (userIds.length > 0) {
                const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
                const profileMap = new Map<string, string | null>()
                if (profiles) (profiles as any[]).forEach(p => profileMap.set(p.user_id, p.full_name))
                rawMembers.forEach(m => { m.full_name = profileMap.get(m.user_id) || null })
            }
            setMembers(rawMembers)
        } catch (err: any) {
            setMemberError(err.message)
        } finally {
            setMembersLoading(false)
        }
    }

    const handleAddMember = async () => {
        if (!addEmail || !selectedTenant) return
        setAddLoading(true)
        setMemberError('')
        try {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(addEmail.trim())
            let userId: string
            if (isUUID) {
                userId = addEmail.trim()
                const { data: profile, error: profileError } = await supabase.from('profiles').select('user_id').eq('user_id', userId).single()
                if (profileError || !profile) throw new Error(t('noUserFound'))
            } else {
                const { data: profiles, error: searchError } = await supabase.from('profiles').select('user_id, full_name').ilike('full_name', `%${addEmail.trim()}%`)
                if (searchError) throw searchError
                const results = (profiles || []) as any[]
                if (results.length === 0) throw new Error(t('noUserFound'))
                if (results.length > 1) {
                    const names = results.map((p: any) => `${p.full_name} (${p.user_id})`).join('\n')
                    throw new Error(`${t('multipleUsersFound')}\n${names}`)
                }
                userId = results[0].user_id
            }
            const { data: existing } = await supabase.from('tenant_members').select('user_id').eq('tenant_id', selectedTenant.id).eq('user_id', userId)
            if (existing && (existing as any[]).length > 0) throw new Error(t('userAlreadyMember'))
            const { error: insertError } = await supabase.from('tenant_members').insert({ tenant_id: selectedTenant.id, user_id: userId, role: addRole })
            if (insertError) throw insertError
            setAddEmail('')
            await fetchMembers(selectedTenant.id)
        } catch (err: any) {
            setMemberError(err.message)
        } finally {
            setAddLoading(false)
        }
    }

    const handleCreateTenantUser = async () => {
        if (!selectedTenant || !createUserEmail.trim() || !createUserPassword.trim()) return
        setCreateUserLoading(true)
        setMemberError('')

        try {
            const trimmedEmail = createUserEmail.trim().toLowerCase()
            const trimmedFullName = createUserFullName.trim()

            const { data: invokeData, error: invokeError } = await supabase.functions.invoke('create-tenant-user', {
                body: {
                    tenantId: selectedTenant.id,
                    email: trimmedEmail,
                    password: createUserPassword,
                    fullName: trimmedFullName || null,
                    role: createUserRole,
                },
            })

            if (invokeError) {
                // Fallback path: when edge function is unavailable, use DB RPC.
                const { error: rpcError } = await (supabase as any).rpc('root_create_tenant_user', {
                    p_tenant_id: selectedTenant.id,
                    p_email: trimmedEmail,
                    p_password: createUserPassword,
                    p_full_name: trimmedFullName || null,
                    p_role: createUserRole,
                })

                if (rpcError) throw rpcError
            } else if (!invokeData) {
                throw new Error('Unexpected empty response while creating tenant user.')
            }

            setCreateUserFullName('')
            setCreateUserEmail('')
            setCreateUserPassword('')
            setCreateUserRole('user')
            await fetchMembers(selectedTenant.id)
        } catch (err: any) {
            let detailedMessage = err?.message || 'Failed to create tenant user'
            const response = err?.context

            if (response && typeof response.text === 'function') {
                try {
                    const rawBody = await response.text()
                    const statusPrefix = typeof response.status === 'number'
                        ? `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
                        : ''

                    if (rawBody) {
                        try {
                            const parsed = JSON.parse(rawBody)
                            const backendError = parsed?.error || parsed?.message
                            detailedMessage = backendError
                                ? `${statusPrefix ? `${statusPrefix} - ` : ''}${backendError}`
                                : `${statusPrefix ? `${statusPrefix} - ` : ''}${rawBody}`
                        } catch {
                            detailedMessage = `${statusPrefix ? `${statusPrefix} - ` : ''}${rawBody}`
                        }
                    } else if (statusPrefix) {
                        detailedMessage = statusPrefix
                    }
                } catch {
                    // Keep generic message if response body is not JSON.
                }
            }

            setMemberError(detailedMessage)
        } finally {
            setCreateUserLoading(false)
        }
    }

    const handleChangeRole = async (member: TenantMember) => {
        if (!selectedTenant) return
        const newRole = member.role === 'admin' ? 'user' : 'admin'
        const { error } = await supabase.from('tenant_members').update({ role: newRole }).eq('tenant_id', member.tenant_id).eq('user_id', member.user_id)
        if (error) { setMemberError(error.message); return }
        await fetchMembers(selectedTenant.id)
    }

    const handleRemoveMember = async (member: TenantMember) => {
        if (!selectedTenant) return
        if (member.user_id === user?.id) {
            if (!confirm(t('confirmRemoveSelf'))) return
        }
        const { error } = await supabase.from('tenant_members').delete().eq('tenant_id', member.tenant_id).eq('user_id', member.user_id)
        if (error) { setMemberError(error.message); return }
        await fetchMembers(selectedTenant.id)
    }

    const columns: ColumnDef<Tenant>[] = [
        { accessorKey: 'name', header: t('tenantName') },
        { accessorKey: 'slug', header: t('tenantSlug') },
        {
            accessorKey: 'created_at', header: t('createdAt'),
            cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString()
        },
        {
            id: 'actions', header: t('actions'),
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleImpersonate(row.original.id)}>
                        {t('switchTo')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openMembersModal(row.original)}>
                        <Users className="h-4 w-4" />
                        {t('members')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openLogoModal(row.original)}>
                        {t('tenantLogo')}
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('tenants')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{tenants.length} {t('tenants').toLowerCase()}</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    {t('createTenant')}
                </Button>
            </div>

            <DataTable columns={columns} data={tenants} searchKey="name" />

            {/* Logo Modal */}
            <Modal isOpen={logoModalOpen} onClose={closeLogoModal} title={`${t('tenantLogo')} — ${logoTenant?.name || ''}`}>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                            {logoPreview ? (
                                <img src={logoPreview} alt={logoTenant?.name || 'logo'} className="h-full w-full object-contain" />
                            ) : (
                                <Building className="h-7 w-7 text-slate-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoFileChange}
                                className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                            />
                            <p className="text-xs text-slate-400 mt-1">PNG/JPG/WebP - max 2MB</p>
                        </div>
                    </div>

                    {logoError && (
                        <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl whitespace-pre-wrap">
                            {logoError}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="secondary" onClick={closeLogoModal} disabled={logoLoading}>
                            {t('cancel')}
                        </Button>
                        <Button variant="ghost" onClick={handleRemoveLogo} disabled={logoLoading || !logoPreview}>
                            {t('removeLogo')}
                        </Button>
                        <Button onClick={handleUploadLogo} disabled={logoLoading || !logoFile}>
                            {logoLoading ? t('saving') : (logoTenant?.logo_url ? t('updateLogo') : t('uploadLogo'))}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Create Modal */}
            <Modal isOpen={isCreateOpen} onClose={resetForm} title={t('createTenant')}>
                <div className="space-y-4">
                    <Input
                        label={t('tenantName')}
                        value={tenantName}
                        onChange={e => {
                            setTenantName(e.target.value)
                            setTenantSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
                        }}
                    />
                    <Input
                        label={t('tenantSlug')}
                        value={tenantSlug}
                        onChange={e => setTenantSlug(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="secondary" onClick={resetForm} disabled={createLoading}>{t('cancel')}</Button>
                        <Button onClick={handleCreateTenant} disabled={createLoading}>
                            {createLoading ? t('creating') : t('createTenant')}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Members Modal */}
            <Modal isOpen={membersModalOpen} onClose={closeMembersModal} title={`${t('members')} — ${selectedTenant?.name || ''}`}>
                <div className="space-y-5">
                    <div className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-100">
                        <h3 className="text-sm font-semibold text-slate-700">{t('createMemberWithCreds')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <Input
                                label={t('fullName')}
                                placeholder={t('fullName')}
                                value={createUserFullName}
                                onChange={e => setCreateUserFullName(e.target.value)}
                            />
                            <Input
                                type="email"
                                label={t('email')}
                                placeholder="user@company.com"
                                value={createUserEmail}
                                onChange={e => setCreateUserEmail(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <Input
                                    type="password"
                                    label={t('password')}
                                    placeholder="••••••••"
                                    value={createUserPassword}
                                    onChange={e => setCreateUserPassword(e.target.value)}
                                />
                            </div>
                            <select
                                value={createUserRole}
                                onChange={e => setCreateUserRole(e.target.value as 'admin' | 'user')}
                                className="h-[42px] rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            >
                                <option value="user">{t('user')}</option>
                                <option value="admin">{t('admin')}</option>
                            </select>
                            <Button
                                onClick={handleCreateTenantUser}
                                disabled={createUserLoading || !createUserEmail.trim() || !createUserPassword.trim()}
                            >
                                {createUserLoading ? t('creating') : t('createUserAndAssign')}
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500">{t('createMemberHint')}</p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-700">{t('addMember')}</h3>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Input label="" placeholder={t('memberNameOrId')} value={addEmail} onChange={e => setAddEmail(e.target.value)} />
                            </div>
                            <select
                                value={addRole}
                                onChange={e => setAddRole(e.target.value as 'admin' | 'user')}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            >
                                <option value="user">{t('user')}</option>
                                <option value="admin">{t('admin')}</option>
                            </select>
                            <Button onClick={handleAddMember} disabled={addLoading || !addEmail.trim()}>
                                {addLoading ? t('adding') : t('add')}
                            </Button>
                        </div>
                        <p className="text-xs text-slate-400">{t('memberHint')}</p>
                    </div>

                    {memberError && (
                        <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl whitespace-pre-wrap">{memberError}</div>
                    )}

                    {membersLoading ? (
                        <div className="text-center py-8 text-slate-500">{t('loadingMembers')}</div>
                    ) : members.length === 0 ? (
                        <div className="text-center py-8">
                            <Building className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-400 text-sm">{t('noMembers')}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                            {members.map(member => (
                                <div key={member.user_id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`flex items-center justify-center h-9 w-9 rounded-full ${member.role === 'admin'
                                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {member.role === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">{member.full_name || t('unnamedUser')}</p>
                                            <p className="text-xs text-slate-400 truncate font-mono">{member.user_id.substring(0, 8)}...</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => handleChangeRole(member)}
                                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 ${member.role === 'admin'
                                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            {member.role === 'admin' ? t('admin') : t('user')}
                                        </button>
                                        <button
                                            onClick={() => handleRemoveMember(member)}
                                            className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                                            title={t('removeMember')}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    )
}
