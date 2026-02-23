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

    const parseMovementReason = (reason: string) => {
        if (reason === 'initial_stock') return t('stockInitial') || 'Stock Initial'
        if (reason === 'restock') return t('restock') || 'Réapprovisionnement'
        if (reason === 'correction') return t('correction') || 'Correction de Stock'
        if (reason === 'rental_start') return t('rentalStart') || 'Départ Location'
        if (reason === 'rental_returned') return t('rentalReturned') || 'Retour Location'

        if (reason.startsWith('Sale #')) return `${t('sale') || 'Vente'} ${reason.replace('Sale ', '')}`
        if (reason.startsWith('Rental return #')) return `${t('rentalReturned') || 'Retour Location'} ${reason.replace('Rental return ', '')}`
        if (reason.startsWith('Rental #')) return `${t('rentalStart') || 'Départ Location'} ${reason.replace('Rental ', '')}`

        return reason
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
                size="2xl"
            >
                <div className="p-6 sm:p-8 space-y-8 bg-slate-50 min-h-full">

                    {movements.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 z-10">
                            {movements.map((event, eventIdx) => (
                                <div key={event.id} className="relative flex gap-6 items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-100 transition-all group">

                                    {/* Big Colorful Status Block */}
                                    <div className={`shrink-0 w-20 h-20 rounded-2xl flex flex-col items-center justify-center shadow-inner relative z-20 border-2
                                        ${event.qty_delta > 0
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-100'
                                            : 'bg-rose-50 text-rose-600 border-rose-100 group-hover:bg-rose-100'
                                        }`}
                                    >
                                        <span className="text-sm font-medium opacity-70 mb-0.5">QTY</span>
                                        <span className="font-black text-2xl leading-none tracking-tight">
                                            {event.qty_delta > 0 ? '+' : ''}{event.qty_delta}
                                        </span>
                                    </div>

                                    {/* Detailed Text Block */}
                                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="space-y-1.5">
                                            <p className="text-lg font-bold text-slate-800">
                                                {parseMovementReason(event.reason)}
                                            </p>

                                            {event.ref_id && (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-mono font-medium">
                                                    Ref: {event.ref_id.substring(0, 8)}...
                                                </div>
                                            )}
                                        </div>

                                        {/* Date and Time formatting block */}
                                        <div className="text-left sm:text-right shrink-0">
                                            <div className="text-sm font-semibold text-slate-700 capitalize">
                                                {new Date(event.created_at).toLocaleDateString(undefined, {
                                                    weekday: 'short',
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </div>
                                            <div className="text-sm font-medium text-slate-400 mt-0.5 flex items-center sm:justify-end gap-1.5">
                                                <History className="h-3.5 w-3.5" />
                                                {new Date(event.created_at).toLocaleTimeString(undefined, {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {movements.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="bg-white p-6 rounded-full shadow-sm mb-5 border border-slate-100 z-10">
                                <History className="h-12 w-12 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">{t('noMovements') || 'No Activity'}</h3>
                            <p className="text-slate-500 max-w-xs mx-auto">
                                Ce produit n'a enregistré aucun mouvement de stock pour le moment.
                            </p>
                        </div>
                    )}
                </div>
            </Drawer>
        </div>
    )
}
