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
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

type Depense = Database['public']['Tables']['depenses']['Row'] & {
    articles?: { nom: string } | null
}

const schema = z.object({
    type: z.enum(['depense_interne', 'voyage', 'retouche_article', 'equipment', 'utilities', 'marketing', 'maintenance', 'software', 'insurance', 'taxes', 'office_supplies', 'other']),
    amount: z.coerce.number().min(0),
    label: z.string().optional(),
    description: z.string().optional(),
    spent_at: z.string().min(1, 'Date is required'),
    article_id: z.string().optional()
}).refine(data => {
    if (data.type === 'retouche_article' && !data.article_id) return false
    return true
}, { message: "Article is required for Retouche", path: ['article_id'] })

type FormData = z.infer<typeof schema>

export default function DepensePage() {
    const [depenses, setDepenses] = useState<Depense[]>([])
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [depenseToDelete, setDepenseToDelete] = useState<string | null>(null)
    const { currentTenant } = useTenant()
    const [articles, setArticles] = useState<{ id: string, nom: string }[]>([])
    const { t } = useI18n()

    const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema) as any,
        defaultValues: {
            type: 'depense_interne',
            spent_at: new Date().toISOString().split('T')[0]
        }
    })

    const type = watch('type')

    useEffect(() => {
        if (currentTenant) { fetchDepenses(); fetchArticles() }
    }, [currentTenant])

    const fetchDepenses = async () => {
        if (!currentTenant) return
        setLoading(true)
        const { data } = await supabase.from('depenses').select('*, articles(nom)').eq('tenant_id', currentTenant.id).order('spent_at', { ascending: false })
        if (data) setDepenses(data)
        setLoading(false)
    }

    const fetchArticles = async () => {
        if (!currentTenant) return
        const { data } = await supabase.from('articles').select('id, nom').eq('tenant_id', currentTenant.id).order('nom')
        if (data) setArticles(data)
    }

    const onSubmit = async (data: FormData) => {
        if (!currentTenant) return
        const { error } = await supabase.from('depenses').insert({
            tenant_id: currentTenant.id, ...data, article_id: data.article_id || null
        })
        if (!error) { setIsModalOpen(false); reset(); fetchDepenses() }
        else alert(error.message)
    }

    const confirmDelete = async () => {
        if (!depenseToDelete) return
        const { error } = await supabase.from('depenses').delete().eq('id', depenseToDelete)
        if (error) alert(error.message)
        else {
            setDepenseToDelete(null)
            fetchDepenses()
        }
    }

    const typeLabel = (val: string) => {
        const types: Record<string, string> = {
            'depense_interne': t('interne'),
            'voyage': t('voyage'),
            'retouche_article': t('retoucheArticle'),
            'equipment': t('equipment'),
            'utilities': t('utilities'),
            'marketing': t('marketing'),
            'maintenance': t('maintenance'),
            'software': t('software'),
            'insurance': t('insurance'),
            'taxes': t('taxes'),
            'office_supplies': t('officeSupplies'),
            'other': t('other')
        }
        return types[val] || val
    }

    const columns: ColumnDef<Depense>[] = [
        {
            accessorKey: 'type', header: t('type'), cell: ({ getValue }) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                    {typeLabel(getValue() as string)}
                </span>
            )
        },
        { accessorKey: 'label', header: t('label') },
        {
            accessorKey: 'amount', header: t('amount'), cell: ({ getValue }) => (
                <span className="font-semibold text-slate-900">{Number(getValue()).toLocaleString()} DT</span>
            )
        },
        { accessorKey: 'spent_at', header: t('date'), cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() },
        { accessorKey: 'articles.nom', header: t('article') },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setDepenseToDelete(row.original.id)}>
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
                    <h1 className="text-2xl font-bold text-slate-900">{t('expensesTitle')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{depenses.length} {t('expenses').toLowerCase()}</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t('newExpense')}
                </Button>
            </div>
            <DataTable columns={columns} data={depenses} searchKey="label" />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('newExpense')}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('type')}</label>
                        <select
                            {...register('type')}
                            className="block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none hover:border-slate-300 transition-all"
                        >
                            <option value="depense_interne">{t('interne')}</option>
                            <option value="voyage">{t('voyage')}</option>
                            <option value="retouche_article">{t('retoucheArticle')}</option>
                            <option value="equipment">{t('equipment')}</option>
                            <option value="utilities">{t('utilities')}</option>
                            <option value="marketing">{t('marketing')}</option>
                            <option value="maintenance">{t('maintenance')}</option>
                            <option value="software">{t('software')}</option>
                            <option value="insurance">{t('insurance')}</option>
                            <option value="taxes">{t('taxes')}</option>
                            <option value="office_supplies">{t('officeSupplies')}</option>
                            <option value="other">{t('other')}</option>
                        </select>
                    </div>

                    {type === 'retouche_article' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('article')}</label>
                            <select
                                {...register('article_id')}
                                className="block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none hover:border-slate-300 transition-all"
                            >
                                <option value="">{t('selectArticle')}</option>
                                {articles.map(a => (<option key={a.id} value={a.id}>{a.nom}</option>))}
                            </select>
                            {errors.article_id && <p className="text-red-600 text-sm mt-1">{errors.article_id.message}</p>}
                        </div>
                    )}

                    <Input label={t('amount')} type="number" step="0.01" {...register('amount')} error={errors.amount?.message} />
                    <Input label={t('label')} {...register('label')} />
                    <Input label={t('description')} {...register('description')} />
                    <Input type="date" label={t('date')} {...register('spent_at')} error={errors.spent_at?.message} />

                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">{t('cancel')}</Button>
                        <Button type="submit" className="w-full sm:w-auto">{t('save')}</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={!!depenseToDelete} onClose={() => setDepenseToDelete(null)} title={t('confirmDelete') || 'Confirm Deletion'}>
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        {t('confirmDelete') || 'Are you sure you want to delete this item? This action cannot be undone.'}
                    </p>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <Button variant="secondary" onClick={() => setDepenseToDelete(null)}>{t('cancel') || 'Cancel'}</Button>
                        <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">{t('delete') || 'Delete'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
