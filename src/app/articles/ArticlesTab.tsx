import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/db'
import { DataTable } from '@/components/ui/DataTable'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/Button'

import { Modal } from '@/components/ui/Modal'
import { useTenant } from '@/lib/tenant'
import { ArticleForm } from './ArticleForm'
import { ArrowLeftRight, Trash2, Pencil } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { useI18n } from '@/lib/i18n'
import { useNavigate } from 'react-router-dom'

type Article = Database['public']['Tables']['articles']['Row'] & {
    famille_name?: string
    category_name?: string
}

export default function ArticlesTab() {
    const navigate = useNavigate()
    const [articles, setArticles] = useState<Article[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<Article | null>(null)
    const [isAdjustOpen, setIsAdjustOpen] = useState(false)
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

    // Delete state
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Article | null>(null)
    const [deleting, setDeleting] = useState(false)

    // Adjustment state
    const [adjustQty, setAdjustQty] = useState(0)
    const [adjustReason, setAdjustReason] = useState('')
    const [adjustNote, setAdjustNote] = useState('')

    const { currentTenant } = useTenant()
    const { t } = useI18n()

    // Filters
    const [familles, setFamilles] = useState<{ id: string, name: string }[]>([])
    const [categories, setCategories] = useState<{ id: string, name: string, famille_id: string }[]>([])
    const [search, setSearch] = useState('')
    const [filterFamille, setFilterFamille] = useState('')
    const [filterCategory, setFilterCategory] = useState('')

    useEffect(() => {
        if (currentTenant) {
            fetchArticles()
            fetchMetadata()
        }
    }, [currentTenant, filterFamille, filterCategory])

    const fetchMetadata = async () => {
        if (!currentTenant) return
        const { data: f } = await supabase.from('famille_articles').select('id, name').eq('tenant_id', currentTenant.id)
        setFamilles(f || [])
        const { data: c } = await supabase.from('article_categories').select('id, name, famille_id').eq('tenant_id', currentTenant.id)
        setCategories(c || [])
    }

    const fetchArticles = async () => {
        if (!currentTenant) return
        setLoading(true)
        let query = supabase
            .from('v_stock_overview')
            .select('*')
            .eq('tenant_id', currentTenant.id)

        if (filterFamille) query = query.eq('famille_id', filterFamille)
        if (filterCategory) query = query.eq('category_id', filterCategory)

        const { data, error } = await query

        if (error) {
            console.error('[Articles] Query error:', error.message, '| Tenant:', currentTenant.id, currentTenant.name)
        } else {
            console.log('[Articles] Loaded', data?.length ?? 0, 'articles for tenant:', currentTenant.name, '(', currentTenant.id, ')')
        }

        if (data) {
            setArticles(data as any[])
        }
        setLoading(false)
    }

    const handleStockAdjust = async () => {
        if (!selectedArticle || !currentTenant || adjustQty === 0 || !adjustReason) return

        const { error } = await supabase.from('stock_movements').insert({
            tenant_id: currentTenant.id,
            article_id: selectedArticle.id,
            qty_delta: adjustQty,
            reason: adjustReason + (adjustNote ? `: ${adjustNote}` : ''),
        })

        if (!error) {
            setIsAdjustOpen(false)
            setSelectedArticle(null)
            setAdjustQty(0)
            setAdjustReason('')
            setAdjustNote('')
            fetchArticles() // refresh stock
        } else {
            alert('Error: ' + error.message)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget || !currentTenant) return
        setDeleting(true)
        const { error } = await supabase.from('articles').delete().eq('id', deleteTarget.id).eq('tenant_id', currentTenant.id)
        setDeleting(false)
        if (error) {
            alert(error.message)
        } else {
            setIsDeleteOpen(false)
            setDeleteTarget(null)
            fetchArticles()
        }
    }

    const columns: ColumnDef<Article>[] = [
        {
            accessorKey: 'photo_url',
            header: t('articlePhoto'),
            cell: ({ row }) => {
                const photoUrl = row.original.photo_url
                if (!photoUrl) return <span className="text-xs text-slate-400">-</span>
                return (
                    <div className="h-10 w-10 rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                        <img src={photoUrl} alt={row.original.nom} className="h-full w-full object-cover" />
                    </div>
                )
            }
        },
        { accessorKey: 'nom', header: t('articleName') },
        { accessorKey: 'famille_name', header: t('famille') },
        { accessorKey: 'category_name', header: t('category') },
        { accessorKey: 'couleur', header: t('color') },
        { accessorKey: 'qte_on_hand', header: t('stockQty') },
        { accessorKey: 'prix_achat', header: t('buyPrice') },
        { accessorKey: 'prix_vente_detail', header: t('retailPrice') },
        { accessorKey: 'prix_vente_gros', header: t('wholesalePrice') },
        { accessorKey: 'prix_location_min', header: t('locationPriceMin') },
        { accessorKey: 'prix_location_max', header: t('locationPriceMax') },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => {
                        setEditTarget(row.original)
                        setIsEditOpen(true)
                    }}>
                        <Pencil className="h-4 w-4 text-slate-600" />
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => {
                        setSelectedArticle(row.original)
                        setAdjustQty(0)
                        setAdjustReason('adjustment')
                        setIsAdjustOpen(true)
                    }}>
                        <ArrowLeftRight className="h-4 w-4 mr-1" /> {t('adjustStock')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                        setDeleteTarget(row.original)
                        setIsDeleteOpen(true)
                    }}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-50 p-4 rounded-xl border border-slate-200 gap-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <select className="rounded-lg border-slate-300 text-sm w-full sm:w-auto" value={filterFamille} onChange={e => { setFilterFamille(e.target.value); setFilterCategory(''); }}>
                        <option value="">{t('allFamilles')}</option>
                        {familles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <select className="rounded-lg border-slate-300 text-sm w-full sm:w-auto disabled:bg-slate-100" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} disabled={!filterFamille}>
                        <option value="">{t('allCategories')}</option>
                        {categories.filter(c => c.famille_id === filterFamille).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 w-full sm:w-auto">
                    <Button variant="secondary" onClick={() => navigate('/app/articles/history')} className="w-full sm:w-auto">
                        Historique Articles
                    </Button>
                    <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto">{t('newArticle')}</Button>
                </div>
            </div>

            <DataTable columns={columns} data={articles} searchKey="nom" />

            <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title={t('newArticle')}>
                <ArticleForm onSuccess={() => { setIsCreateOpen(false); fetchArticles(); }} onCancel={() => setIsCreateOpen(false)} />
            </Modal>

            <Modal isOpen={isEditOpen} onClose={() => { setIsEditOpen(false); setEditTarget(null) }} title={t('editArticle')}>
                {editTarget && (
                    <ArticleForm
                        initialData={editTarget}
                        onSuccess={() => {
                            setIsEditOpen(false)
                            setEditTarget(null)
                            fetchArticles()
                        }}
                        onCancel={() => {
                            setIsEditOpen(false)
                            setEditTarget(null)
                        }}
                    />
                )}
            </Modal>

            <Modal isOpen={isAdjustOpen} onClose={() => setIsAdjustOpen(false)} title={`${t('adjustStock')}: ${selectedArticle?.nom}`}>
                <div className="space-y-4">
                    <Input label={t('qtyDelta')} type="number" value={adjustQty} onChange={e => setAdjustQty(parseInt(e.target.value))} />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('reason')}</label>
                        <select className="block w-full rounded-md border-gray-300" value={adjustReason} onChange={e => setAdjustReason(e.target.value)}>
                            <option value="adjustment">{t('adjustment')}</option>
                            <option value="correction">{t('correction')}</option>
                            <option value="damage">{t('damage')}</option>
                            <option value="other">{t('other')}</option>
                        </select>
                    </div>
                    <Input label={t('note')} value={adjustNote} onChange={e => setAdjustNote(e.target.value)} />
                    <div className="flex justify-end gap-2 text-sm text-gray-500">
                        Current Stock: {selectedArticle?.qte_on_hand} | New Stock: {(selectedArticle?.qte_on_hand || 0) + (adjustQty || 0)}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setIsAdjustOpen(false)}>{t('cancel')}</Button>
                        <Button onClick={handleStockAdjust}>{t('confirm')}</Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title={t('deleteConfirmTitle')}>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
                        <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-700">
                            {t('deleteConfirmMessage')} <strong>{deleteTarget?.nom}</strong>?
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
