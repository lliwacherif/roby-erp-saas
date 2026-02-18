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

type Category = Database['public']['Tables']['article_categories']['Row'] & {
    famille_name?: string
}

export default function CategoriesTab() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newName, setNewName] = useState('')
    const [newFamilleId, setNewFamilleId] = useState('')
    const [familles, setFamilles] = useState<{ id: string, name: string }[]>([])
    const { currentTenant } = useTenant()
    const { t } = useI18n()

    // Delete state
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        if (currentTenant) {
            fetchCategories()
            fetchFamilles()
        }
    }, [currentTenant])

    const fetchCategories = async () => {
        if (!currentTenant) return
        setLoading(true)
        const { data, error } = await supabase
            .from('article_categories')
            .select('*, famille_articles(name)')
            .eq('tenant_id', currentTenant.id)
            .order('name')

        if (data && !error) {
            const formatted = (data as any[]).map(d => ({
                ...d,
                famille_name: d.famille_articles?.name
            }))
            setCategories(formatted)
        }
        setLoading(false)
    }

    const fetchFamilles = async () => {
        if (!currentTenant) return
        const { data } = await supabase.from('famille_articles').select('id, name').eq('tenant_id', currentTenant.id)
        if (data) setFamilles(data)
    }

    const handleCreate = async () => {
        if (!newName || !newFamilleId || !currentTenant) return
        const { error } = await supabase.from('article_categories').insert({
            tenant_id: currentTenant.id,
            name: newName,
            famille_id: newFamilleId
        })

        if (!error) {
            setNewName('')
            setNewFamilleId('')
            setIsModalOpen(false)
            fetchCategories()
        } else {
            alert(error.message)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget || !currentTenant) return
        setDeleting(true)
        const { error } = await supabase.from('article_categories').delete().eq('id', deleteTarget.id).eq('tenant_id', currentTenant.id)
        setDeleting(false)
        if (error) {
            alert(error.message)
        } else {
            setIsDeleteOpen(false)
            setDeleteTarget(null)
            fetchCategories()
        }
    }

    const columns: ColumnDef<Category>[] = [
        { accessorKey: 'name', header: t('categoryName') },
        { accessorKey: 'famille_name', header: t('famille') },
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
                    <Plus className="h-4 w-4 mr-2" /> {t('newCategory')}
                </Button>
            </div>
            <DataTable columns={columns} data={categories} searchKey="name" />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('newCategory')}>
                <div className="space-y-4">
                    <Input label={t('categoryName')} value={newName} onChange={e => setNewName(e.target.value)} />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('famille')}</label>
                        <select
                            value={newFamilleId}
                            onChange={e => setNewFamilleId(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        >
                            <option value="">{t('selectFamille')}</option>
                            {familles.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>
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
