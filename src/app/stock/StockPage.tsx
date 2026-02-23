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
                <div className="flex justify-end pr-4">
                    <Button
                        size="sm"
                        onClick={() => setSelectedArticleId(row.original.id!)}
                        className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 hover:scale-105 transition-all shadow-sm font-medium"
                    >
                        <History className="h-4 w-4 mr-2" />
                        {t('history')}
                    </Button>
                </div>
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
                title={stock.find(s => s.id === selectedArticleId)?.nom || t('stockHistory')}
            >
                <div className="p-4 sm:p-6 space-y-6">
                    {movements.map((event, eventIdx) => (
                        <div key={event.id} className="relative flex gap-4">
                            {/* Vertical Line Connector */}
                            {eventIdx !== movements.length - 1 && (
                                <div className="absolute left-6 top-12 bottom-[-24px] w-px bg-slate-200" />
                            )}

                            {/* Quantity Bubble */}
                            <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm z-10 font-bold text-lg
                                ${event.qty_delta > 0
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-100 text-rose-700 border border-rose-200'
                                }`}
                            >
                                {event.qty_delta > 0 ? '+' : ''}{event.qty_delta}
                            </div>

                            {/* Info Card */}
                            <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start gap-2">
                                    <p className="text-sm font-semibold text-slate-800 leading-tight">
                                        {event.reason}
                                    </p>
                                </div>
                                <div className="mt-2 text-xs font-medium text-slate-500">
                                    <time dateTime={event.created_at}>
                                        {new Date(event.created_at).toLocaleString(undefined, {
                                            weekday: 'short',
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </time>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Empty State */}
                    {movements.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="bg-slate-50 p-4 rounded-full mb-4">
                                <History className="h-8 w-8 text-slate-400" />
                            </div>
                            <p className="text-slate-600 font-medium">{t('noMovements')}</p>
                            <p className="text-slate-400 text-sm mt-1">Aucune action n'a été effectuée sur cet article.</p>
                        </div>
                    )}
                </div>
            </Drawer>
        </div>
    )
}
