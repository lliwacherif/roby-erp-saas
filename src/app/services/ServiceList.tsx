import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/db'
import { DataTable } from '@/components/ui/DataTable'
import { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useTenant } from '@/lib/tenant'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/lib/i18n'
import { applyDueRentalStarts } from '@/lib/rentalStock'
import { Plus, Eye, RotateCcw, Trash2, CalendarDays, User, Package, Hash, Clock, FileText } from 'lucide-react'

type Service = Database['public']['Tables']['services']['Row'] & {
    clients: { full_name: string } | null
}

type ServiceItem = {
    id: string
    article_id: string
    qty: number
    unit_price: number
    rental_deposit?: number | null
    rental_start?: string | null
    rental_end?: string | null
    article_name?: string
}

type ReturnCandidate = {
    id: string
    article_id: string
    qty: number
    article_name: string
    rental_start: string | null
    rental_end: string | null
    canReturn: boolean
    stateLabel?: string
}

export default function ServiceList() {
    const [services, setServices] = useState<Service[]>([])
    const [loading, setLoading] = useState(true)
    const { currentTenant } = useTenant()
    const navigate = useNavigate()
    const { t } = useI18n()

    // Delete state
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
    const [deleting, setDeleting] = useState(false)

    // Detail modal state
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [detailService, setDetailService] = useState<Service | null>(null)
    const [detailItems, setDetailItems] = useState<ServiceItem[]>([])
    const [detailLoading, setDetailLoading] = useState(false)
    const [returnModalOpen, setReturnModalOpen] = useState(false)
    const [returnCandidates, setReturnCandidates] = useState<ReturnCandidate[]>([])
    const [returnServiceId, setReturnServiceId] = useState<string | null>(null)
    const [selectedReturnItemId, setSelectedReturnItemId] = useState<string>('')

    useEffect(() => {
        if (currentTenant) {
            syncRentalState()
        }
    }, [currentTenant])

    const syncRentalState = async () => {
        if (!currentTenant) return
        await applyDueRentalStarts(currentTenant.id)
        await autoReturnExpired()
        await fetchServices()
    }

    const fetchServices = async () => {
        if (!currentTenant) return
        setLoading(true)
        const { data } = await supabase
            .from('services')
            .select('*, clients(full_name)')
            .eq('tenant_id', currentTenant.id)
            .order('created_at', { ascending: false })

        if (data) setServices(data as Service[])
        setLoading(false)
    }

    // ── Auto-return expired rentals ──
    const autoReturnExpired = async () => {
        if (!currentTenant) return

        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

        // Find confirmed location services where rental_end <= today
        const { data: expired } = await supabase
            .from('services')
            .select('id')
            .eq('tenant_id', currentTenant.id)
            .eq('type', 'location')
            .eq('status', 'confirmed')
            .lte('rental_end', today)

        if (!expired || expired.length === 0) return

        for (const svc of expired) await performReturn(svc.id, true)
    }

    const getReturnableItems = async (serviceId: string): Promise<ReturnCandidate[]> => {
        if (!currentTenant) return []

        // 1. Get items
        const { data: rawItems } = await supabase
            .from('service_items')
            .select('id, article_id, qty, rental_start, rental_end, articles(nom)')
            .eq('service_id', serviceId)
        const items = ((rawItems || []) as any[]).map((i) => ({
            id: i.id as string,
            article_id: i.article_id as string,
            qty: i.qty as number,
            article_name: i.articles?.nom || '—',
            rental_start: i.rental_start ?? null,
            rental_end: i.rental_end ?? null,
            canReturn: true,
        }))
        if (!items || items.length === 0) return []

        const itemIds = items.map((i) => i.id)
        const { data: newStartMovements } = await supabase
            .from('stock_movements')
            .select('ref_id')
            .eq('tenant_id', currentTenant.id)
            .eq('ref_table', 'service_items')
            .eq('reason', 'rental_start')
            .in('ref_id', itemIds)

        const { data: newReturnMovements } = await supabase
            .from('stock_movements')
            .select('ref_id')
            .eq('tenant_id', currentTenant.id)
            .eq('ref_table', 'service_items')
            .eq('reason', 'rental_return')
            .in('ref_id', itemIds)

        // Backward compatibility for old services created before per-item rental starts.
        const { data: legacyStarts } = await supabase
            .from('stock_movements')
            .select('id')
            .eq('tenant_id', currentTenant.id)
            .eq('ref_table', 'services')
            .eq('ref_id', serviceId)
            .ilike('reason', 'Rental Out #%')
            .limit(1)

        const { data: legacyReturns } = await supabase
            .from('stock_movements')
            .select('id')
            .eq('tenant_id', currentTenant.id)
            .eq('ref_table', 'services')
            .eq('ref_id', serviceId)
            .ilike('reason', 'location_return #%')
            .limit(1)

        const startedIds = new Set((newStartMovements || []).map((m: any) => m.ref_id).filter(Boolean))
        const returnedIds = new Set((newReturnMovements || []).map((m: any) => m.ref_id).filter(Boolean))
        const isLegacyStarted = Boolean((legacyStarts || []).length)
        const isLegacyReturned = Boolean((legacyReturns || []).length)

        const itemsToReturn = isLegacyStarted && !isLegacyReturned
            ? items
            : items.filter((item) => startedIds.has(item.id) && !returnedIds.has(item.id))

        return itemsToReturn
    }

    // ── Shared return logic ──
    const performReturn = async (serviceId: string, silent = false, itemIds?: string[]) => {
        if (!currentTenant) return

        const returnable = await getReturnableItems(serviceId)
        if (returnable.length === 0) {
            if (!silent) alert('No started rental items to return yet.')
            return
        }

        const itemsToReturn = itemIds?.length
            ? returnable.filter((item) => itemIds.includes(item.id))
            : returnable
        if (itemsToReturn.length === 0) {
            if (!silent) alert('Please select a product to return.')
            return
        }

        // 2. Create restock movements only for started/unreturned items
        const movements = itemsToReturn.map(item => ({
            tenant_id: currentTenant.id,
            article_id: item.article_id,
            qty_delta: item.qty,
            reason: 'rental_return',
            ref_table: 'service_items',
            ref_id: item.id
        }))

        const { error: moveError } = await supabase.from('stock_movements').insert(movements)
        if (moveError) {
            if (!silent) alert('Error restocking: ' + moveError.message)
            return
        }

        // 3. If all started items are returned, mark service as returned
        const remainingAfterReturn = await getReturnableItems(serviceId)
        if (remainingAfterReturn.length === 0) {
            const { error: updateError } = await supabase.from('services').update({ status: 'returned' }).eq('id', serviceId)
            if (updateError && !silent) {
                alert('Error updating status: ' + updateError.message)
            }
        }
    }

    const handleReturn = async (serviceId: string) => {
        if (!currentTenant) return
        const { data: rawAllItems } = await supabase
            .from('service_items')
            .select('id, article_id, qty, rental_start, rental_end, articles(nom)')
            .eq('service_id', serviceId)
        const allItems = ((rawAllItems || []) as any[]).map((i) => ({
            id: i.id as string,
            article_id: i.article_id as string,
            qty: i.qty as number,
            article_name: i.articles?.nom || '—',
            rental_start: i.rental_start ?? null,
            rental_end: i.rental_end ?? null,
        }))

        const candidates = await getReturnableItems(serviceId)
        if (candidates.length === 0) {
            alert('No started rental items to return yet.')
            return
        }

        if (allItems.length <= 1 && candidates.length === 1) {
            if (!confirm('Mark this product as returned and restock it?')) return
            await performReturn(serviceId, false, [candidates[0].id])
            fetchServices()
            return
        }

        const returnableIds = new Set(candidates.map((c) => c.id))
        const modalItems: ReturnCandidate[] = allItems.map((item) => ({
            ...item,
            canReturn: returnableIds.has(item.id),
            stateLabel: returnableIds.has(item.id) ? 'Retournable' : 'Pas encore retournable',
        }))

        setReturnServiceId(serviceId)
        setReturnCandidates(modalItems)
        setSelectedReturnItemId(modalItems.find((i) => i.canReturn)?.id || '')
        setReturnModalOpen(true)
    }

    const confirmReturnSelection = async () => {
        if (!returnServiceId || !selectedReturnItemId) return
        await performReturn(returnServiceId, false, [selectedReturnItemId])
        setReturnModalOpen(false)
        setReturnCandidates([])
        setSelectedReturnItemId('')
        setReturnServiceId(null)
        fetchServices()
    }

    const handleDelete = async () => {
        if (!deleteTarget || !currentTenant) return
        setDeleting(true)
        const { error } = await supabase.from('services').delete().eq('id', deleteTarget.id).eq('tenant_id', currentTenant.id)
        setDeleting(false)
        if (error) {
            alert(error.message)
        } else {
            setIsDeleteOpen(false)
            setDeleteTarget(null)
            fetchServices()
        }
    }

    // ── View Details ──
    const openDetails = async (service: Service) => {
        setDetailService(service)
        setDetailLoading(true)
        setIsDetailOpen(true)

        // Fetch service items with article names
        const { data: items } = await supabase
            .from('service_items')
            .select('id, article_id, qty, unit_price, rental_deposit, rental_start, rental_end, articles(nom)')
            .eq('service_id', service.id)

        const mapped: ServiceItem[] = ((items || []) as any[]).map(i => ({
            id: i.id,
            article_id: i.article_id,
            qty: i.qty,
            unit_price: i.unit_price,
            rental_deposit: i.rental_deposit ?? null,
            rental_start: i.rental_start ?? null,
            rental_end: i.rental_end ?? null,
            article_name: i.articles?.nom || '—'
        }))

        setDetailItems(mapped)
        setDetailLoading(false)
    }

    const detailDepositTotal = detailItems.reduce((acc, item) => acc + (Number(item.rental_deposit) || 0), 0)

    const statusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return 'bg-emerald-100 text-emerald-700'
            case 'returned': return 'bg-slate-100 text-slate-600'
            case 'cancelled': return 'bg-red-100 text-red-700'
            default: return 'bg-amber-100 text-amber-700'
        }
    }

    const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

    const columns: ColumnDef<Service>[] = [
        {
            accessorKey: 'id', header: t('id'), cell: ({ getValue }) => (
                <span className="font-mono text-xs text-slate-500">{(getValue() as string).slice(0, 8)}</span>
            )
        },
        {
            accessorKey: 'type', header: t('type'), cell: ({ getValue }) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                    {(getValue() as string).toUpperCase()}
                </span>
            )
        },
        { accessorKey: 'clients.full_name', header: t('client') },
        {
            accessorKey: 'status',
            header: t('status'),
            cell: ({ getValue }) => {
                const status = getValue() as string
                return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor(status)}`}>
                    {status.toUpperCase()}
                </span>
            }
        },
        {
            accessorKey: 'total', header: t('total'), cell: ({ getValue }) => (
                <span className="font-semibold text-slate-900">{Number(getValue()).toLocaleString()} DT</span>
            )
        },
        { accessorKey: 'created_at', header: t('date'), cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => openDetails(row.original)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                    {row.original.type === 'location' && row.original.status === 'confirmed' && (
                        <Button size="sm" variant="primary" onClick={() => handleReturn(row.original.id)}>
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    )}
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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('servicesTitle')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{services.length} {t('services').toLowerCase()}</p>
                </div>
                <Button onClick={() => navigate('/app/services/new')} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t('newService')}
                </Button>
            </div>
            <DataTable columns={columns} data={services} searchKey="clients.full_name" />

            {/* ── Detail Modal ── */}
            <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title={t('serviceDetails')}>
                {detailService && (
                    <div className="space-y-5">
                        {/* Header Info */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
                                <Hash className="h-4 w-4 text-slate-400" />
                                <div>
                                    <p className="text-xs text-slate-400">{t('id')}</p>
                                    <p className="text-sm font-mono font-semibold text-slate-700">{detailService.id.slice(0, 8)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
                                <User className="h-4 w-4 text-slate-400" />
                                <div>
                                    <p className="text-xs text-slate-400">{t('client')}</p>
                                    <p className="text-sm font-semibold text-slate-700">{detailService.clients?.full_name || '—'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-slate-400 mb-1">{t('type')}</p>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                    {detailService.type.toUpperCase()}
                                </span>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-slate-400 mb-1">{t('status')}</p>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor(detailService.status)}`}>
                                    {detailService.status.toUpperCase()}
                                </span>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-slate-400 mb-1">{t('total')}</p>
                                <p className="text-sm font-bold text-slate-900">{fmt(detailService.total)} DT</p>
                            </div>
                        </div>

                        {/* Rental dates */}
                        {detailService.type === 'location' && (
                            <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <CalendarDays className="h-4 w-4 text-blue-500" />
                                    <span className="font-medium text-blue-700">{t('rentalPeriod')}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <div>
                                        <span className="text-xs text-blue-400">{t('from')}</span>
                                        <p className="font-semibold text-blue-800">
                                            {detailService.rental_start ? new Date(detailService.rental_start).toLocaleDateString() : '—'}
                                        </p>
                                    </div>
                                    <div className="text-blue-300">→</div>
                                    <div className="text-right">
                                        <span className="text-xs text-blue-400">{t('to')}</span>
                                        <p className="font-semibold text-blue-800">
                                            {detailService.rental_end ? new Date(detailService.rental_end).toLocaleDateString() : '—'}
                                        </p>
                                    </div>
                                </div>
                                {(detailDepositTotal > 0 || (detailService.rental_deposit != null && detailService.rental_deposit > 0)) && (
                                    <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                                        <span className="text-xs text-blue-500">{t('deposit')}</span>
                                        <span className="text-sm font-bold text-blue-800">
                                            {fmt(detailDepositTotal > 0 ? detailDepositTotal : (detailService.rental_deposit ?? 0))} DT
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Items Table */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Package className="h-4 w-4 text-slate-400" />
                                <h3 className="text-sm font-semibold text-slate-700">{t('serviceItems')}</h3>
                            </div>
                            {detailLoading ? (
                                <div className="text-center py-4">
                                    <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                </div>
                            ) : detailItems.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">{t('noResults')}</p>
                            ) : (
                                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                                    <table className="w-full text-sm min-w-[600px]">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="text-left px-4 py-2 font-medium text-slate-500">{t('articles')}</th>
                                                <th className="text-center px-4 py-2 font-medium text-slate-500">{t('qty')}</th>
                                                <th className="text-right px-4 py-2 font-medium text-slate-500">{t('unitPrice')}</th>
                                                {detailService.type === 'location' && (
                                                    <>
                                                        <th className="text-right px-4 py-2 font-medium text-slate-500">{t('deposit')}</th>
                                                        <th className="text-center px-4 py-2 font-medium text-slate-500">{t('from')}</th>
                                                        <th className="text-center px-4 py-2 font-medium text-slate-500">{t('to')}</th>
                                                    </>
                                                )}
                                                <th className="text-right px-4 py-2 font-medium text-slate-500">{t('total')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {detailItems.map(item => (
                                                <tr key={item.id}>
                                                    <td className="px-4 py-2.5 font-medium text-slate-700">{item.article_name}</td>
                                                    <td className="px-4 py-2.5 text-center text-slate-600">{item.qty}</td>
                                                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(item.unit_price)} DT</td>
                                                    {detailService.type === 'location' && (
                                                        <>
                                                            <td className="px-4 py-2.5 text-right text-slate-600">{fmt(Number(item.rental_deposit) || 0)} DT</td>
                                                            <td className="px-4 py-2.5 text-center text-slate-600">
                                                                {item.rental_start ? new Date(item.rental_start).toLocaleDateString() : '—'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center text-slate-600">
                                                                {item.rental_end ? new Date(item.rental_end).toLocaleDateString() : '—'}
                                                            </td>
                                                        </>
                                                    )}
                                                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmt(item.qty * item.unit_price)} DT</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50">
                                            <tr>
                                                <td colSpan={detailService.type === 'location' ? 6 : 3} className="px-4 py-2.5 text-right font-semibold text-slate-700">{t('total')}</td>
                                                <td className="px-4 py-2.5 text-right font-bold text-slate-900">{fmt(detailService.total)} DT</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Created date */}
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Clock className="h-3.5 w-3.5" />
                                {t('date')}: {new Date(detailService.created_at).toLocaleString()}
                            </div>
                            <Button
                                size="sm"
                                onClick={() => {
                                    navigate(`/app/services/${detailService.id}/invoice`)
                                    setIsDetailOpen(false)
                                }}
                            >
                                <FileText className="h-4 w-4" />
                                Facture
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Delete Confirmation Modal ── */}
            <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title={t('deleteConfirmTitle')}>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
                        <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-700">
                            {t('deleteConfirmMessage')} <strong>{deleteTarget?.clients?.full_name || 'Service'}</strong>?
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                        <Button variant="secondary" onClick={() => setIsDeleteOpen(false)} className="w-full sm:w-auto">{t('cancel')}</Button>
                        <Button onClick={handleDelete} disabled={deleting}
                            className="w-full sm:w-auto !bg-red-600 hover:!bg-red-700 !shadow-none">
                            {deleting ? t('loading') : t('delete')}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Return Item Selection Modal ── */}
            <Modal
                isOpen={returnModalOpen}
                onClose={() => {
                    setReturnModalOpen(false)
                    setReturnCandidates([])
                    setSelectedReturnItemId('')
                    setReturnServiceId(null)
                }}
                title="Selectionner le produit a retourner"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">
                        Ce service contient plusieurs produits location. Selectionnez le produit a marquer comme retourne.
                    </p>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                        {returnCandidates.map((item) => (
                            <label
                                key={item.id}
                                className={`flex items-start gap-3 p-3 rounded-xl border transition ${!item.canReturn
                                        ? 'border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed'
                                        : selectedReturnItemId === item.id
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="return-item"
                                    checked={selectedReturnItemId === item.id}
                                    onChange={() => item.canReturn && setSelectedReturnItemId(item.id)}
                                    disabled={!item.canReturn}
                                    className="mt-1"
                                />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800">{item.article_name}</p>
                                    <p className="text-xs text-slate-500">
                                        Qte: {item.qty}
                                        {item.rental_start ? ` • Du: ${new Date(item.rental_start).toLocaleDateString()}` : ''}
                                        {item.rental_end ? ` • Au: ${new Date(item.rental_end).toLocaleDateString()}` : ''}
                                    </p>
                                    {item.stateLabel && (
                                        <p className={`text-[11px] mt-1 ${item.canReturn ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {item.stateLabel}
                                        </p>
                                    )}
                                </div>
                            </label>
                        ))}
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                        <Button
                            variant="secondary"
                            className="w-full sm:w-auto"
                            onClick={() => {
                                setReturnModalOpen(false)
                                setReturnCandidates([])
                                setSelectedReturnItemId('')
                                setReturnServiceId(null)
                            }}
                        >
                            Annuler
                        </Button>
                        <Button onClick={confirmReturnSelection} disabled={!selectedReturnItemId} className="w-full sm:w-auto">
                            Marquer retourne
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
