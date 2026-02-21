import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'
import type { Database } from '@/types/db'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Plus, Pencil, Trash2, User, History } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'

type Client = Database['public']['Tables']['clients']['Row']

export default function ClientList() {
    const { currentTenant } = useTenant()
    const { t } = useI18n()
    const navigate = useNavigate()
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (currentTenant) fetchClients()
    }, [currentTenant])

    const fetchClients = async () => {
        if (!currentTenant) return
        setLoading(true)
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('tenant_id', currentTenant.id)
            .order('created_at', { ascending: false })

        if (error) console.error(error)
        if (data) setClients(data as Client[])
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm(t('confirmDelete'))) return
        const { error } = await supabase.from('clients').delete().eq('id', id)
        if (error) alert(error.message)
        else fetchClients()
    }

    const columns: ColumnDef<Client>[] = [
        {
            accessorKey: 'full_name',
            header: t('fullName'),
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <User className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="font-medium text-slate-900">{row.original.full_name}</div>
                        {row.original.email && <div className="text-xs text-slate-500">{row.original.email}</div>}
                    </div>
                </div>
            )
        },
        {
            accessorKey: 'phone',
            header: t('phone'),
            cell: ({ row }) => row.original.phone || '-'
        },
        {
            accessorKey: 'cin',
            header: t('cin') || 'CIN',
            cell: ({ row }) => (
                row.original.cin ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-mono font-medium">
                        {row.original.cin}
                    </span>
                ) : '-'
            )
        },
        {
            accessorKey: 'address',
            header: t('address') || 'Address',
            cell: ({ row }) => <span className="text-slate-500 truncate max-w-[200px] block" title={row.original.address || ''}>{row.original.address || '-'}</span>
        },
        {
            id: 'actions',
            header: t('actions'),
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/app/clients/${row.original.id}/history`)}>
                        <History className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/app/clients/${row.original.id}`)}>
                        <Pencil className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(row.original.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('clients') || 'Clients'}</h1>
                    <p className="text-sm text-slate-500 mt-1">{clients.length} {t('clients')?.toLowerCase() || 'clients'}</p>
                </div>
                <Button onClick={() => navigate('/app/clients/new')} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('newClient') || 'New Client'}
                </Button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <DataTable columns={columns} data={clients} searchKey="full_name" />
            </div>
        </div>
    )
}
