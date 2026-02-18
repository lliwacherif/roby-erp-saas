import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/db'
import { DataTable } from '@/components/ui/DataTable'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'
import { History, RefreshCw } from 'lucide-react'

type StockView = Database['public']['Views']['v_stock_overview']['Row']
type Movement = Database['public']['Tables']['stock_movements']['Row']

export default function StockPage() {
    const [stock, setStock] = useState<StockView[]>([])
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [loading, setLoading] = useState(true)
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
    const [movements, setMovements] = useState<Movement[]>([])
    const { currentTenant } = useTenant()
    const { t } = useI18n()

    useEffect(() => {
        if (currentTenant) fetchStock()
    }, [currentTenant])

    useEffect(() => {
        if (currentTenant && selectedArticleId) fetchMovements(selectedArticleId)
    }, [currentTenant, selectedArticleId])

    const fetchStock = async () => {
        if (!currentTenant) return
        setLoading(true)
        const { data } = await supabase.from('v_stock_overview').select('*').eq('tenant_id', currentTenant.id).order('nom')
        if (data) setStock(data as StockView[])
        setLoading(false)
    }

    const fetchMovements = async (articleId: string) => {
        if (!currentTenant) return
        const { data } = await supabase.from('stock_movements').select('*').eq('tenant_id', currentTenant.id).eq('article_id', articleId).order('created_at', { ascending: false })
        if (data) setMovements(data as Movement[])
    }

    const columns: ColumnDef<StockView>[] = [
        { accessorKey: 'nom', header: t('article') },
        { accessorKey: 'famille_name', header: t('famille') },
        { accessorKey: 'category_name', header: t('category') },
        { accessorKey: 'couleur', header: t('color') },
        {
            accessorKey: 'qte_on_hand', header: t('stock'),
            cell: ({ getValue }) => {
                const val = getValue() as number
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${val < 0 ? 'bg-red-100 text-red-700' : val === 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                        {val}
                    </span>
                )
            }
        },
        { accessorKey: 'prix_achat', header: t('buyPrice') },
        {
            id: 'history',
            cell: ({ row }) => (
                <Button size="sm" variant="ghost" onClick={() => setSelectedArticleId(row.original.id!)}>
                    <History className="h-4 w-4" />
                    {t('history')}
                </Button>
            )
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('stockOverview')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{stock.length} {t('articles').toLowerCase()}</p>
                </div>
                <Button variant="secondary" onClick={fetchStock}>
                    <RefreshCw className="h-4 w-4" />
                    {t('refresh')}
                </Button>
            </div>

            <DataTable columns={columns} data={stock} searchKey="nom" />

            <Drawer
                isOpen={!!selectedArticleId}
                onClose={() => { setSelectedArticleId(null); setMovements([]); }}
                title={t('stockHistory')}
            >
                <div className="flow-root">
                    <ul role="list" className="-mb-8">
                        {movements.map((event, eventIdx) => (
                            <li key={event.id}>
                                <div className="relative pb-8">
                                    {eventIdx !== movements.length - 1 ? (
                                        <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                                    ) : null}
                                    <div className="relative flex space-x-4">
                                        <div>
                                            <span className={`h-10 w-10 rounded-full flex items-center justify-center ring-8 ring-white text-sm font-bold ${event.qty_delta > 0 ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                                                }`}>
                                                {event.qty_delta > 0 ? '+' : '−'}
                                            </span>
                                        </div>
                                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-2">
                                            <div>
                                                <p className="text-sm text-slate-600">
                                                    {event.reason} <span className="font-semibold text-slate-900">{event.qty_delta > 0 ? `+${event.qty_delta}` : event.qty_delta}</span>
                                                </p>
                                            </div>
                                            <div className="whitespace-nowrap text-right text-xs text-slate-400">
                                                <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                        {movements.length === 0 && <p className="text-slate-400 text-center py-8 text-sm">{t('noMovements')}</p>}
                    </ul>
                </div>
            </Drawer>
        </div>
    )
}
