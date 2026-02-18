import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/db'
import { DataTable } from '@/components/ui/DataTable'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'
import { Plus, Trash2 } from 'lucide-react'

type Famille = Database['public']['Tables']['famille_articles']['Row']

export default function FamillesTab() {
    const [familles, setFamilles] = useState<Famille[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newName, setNewName] = useState('')
    const { currentTenant } = useTenant()
    const { t } = useI18n()

    // Delete state
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Famille | null>(null)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        if (currentTenant) fetchFamilles()
    }, [currentTenant])

    const fetchFamilles = async () => {
        if (!currentTenant) return
        setLoading(true)
        const { data } = await supabase
            .from('famille_articles')
            .select('*')
            .eq('tenant_id', currentTenant.id)
            .order('name')

        if (data) setFamilles(data as Famille[])
        setLoading(false)
    }

    const handleCreate = async () => {
        if (!newName || !currentTenant) return
        const { error } = await supabase.from('famille_articles').insert({
            tenant_id: currentTenant.id,
            name: newName
        })

        if (!error) {
            setNewName('')
            setIsModalOpen(false)
            fetchFamilles()
        } else {
            alert(error.message)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget || !currentTenant) return
        setDeleting(true)
        const { error } = await supabase.from('famille_articles').delete().eq('id', deleteTarget.id).eq('tenant_id', currentTenant.id)
        setDeleting(false)
        if (error) {
            alert(error.message)
        } else {
            setIsDeleteOpen(false)
            setDeleteTarget(null)
            fetchFamilles()
        }
    }

    const columns: ColumnDef<Famille>[] = [
        { accessorKey: 'name', header: t('familleName') },
        {
            id: 'actions',
            cell: ({ row }) => (
                <Button size="sm" variant="ghost" onClick={() => {
                    setDeleteTarget(row.original)
                    setIsDeleteOpen(true)
                }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
            )
        }
    ]

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> {t('newFamille')}
                </Button>
            </div>
            <DataTable columns={columns} data={familles} searchKey="name" />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('newFamille')}>
                <div className="space-y-4">
                    <Input label={t('familleName')} value={newName} onChange={e => setNewName(e.target.value)} />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('cancel')}</Button>
                        <Button onClick={handleCreate}>{t('save')}</Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title={t('deleteConfirmTitle')}>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
                        <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-700">
                            {t('deleteConfirmMessage')} <strong>{deleteTarget?.name}</strong>?
                        </p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setIsDeleteOpen(false)}>{t('cancel')}</Button>
                        <Button onClick={handleDelete} disabled={deleting}
                            className="!bg-red-600 hover:!bg-red-700 !shadow-none">
                            {deleting ? t('loading') : t('delete')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
