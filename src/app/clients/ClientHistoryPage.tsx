import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'
import type { Database } from '@/types/db'
import { ArrowLeft, CalendarDays, Receipt, ShoppingBag, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type Client = Database['public']['Tables']['clients']['Row']
type Service = Database['public']['Tables']['services']['Row']

type ServiceWithItems = Service & {
    items: {
        id: string
        qty: number
        unit_price: number
        article_name: string
    }[]
}

const currency = (value: number) =>
    value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ClientHistoryPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { currentTenant } = useTenant()
    const { t } = useI18n()

    const [loading, setLoading] = useState(true)
    const [client, setClient] = useState<Client | null>(null)
    const [services, setServices] = useState<ServiceWithItems[]>([])

    useEffect(() => {
        if (currentTenant && id) {
            fetchHistory()
        }
    }, [currentTenant, id])

    const fetchHistory = async () => {
        if (!currentTenant || !id) return
        setLoading(true)

        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', currentTenant.id)
            .single()

        if (clientError || !clientData) {
            navigate('/app/clients')
            return
        }
        setClient(clientData as Client)

        const { data: servicesData, error: servicesError } = await supabase
            .from('services')
            .select('*')
            .eq('tenant_id', currentTenant.id)
            .eq('client_id', id)
            .order('created_at', { ascending: false })

        if (servicesError) {
            setLoading(false)
            return
        }

        const baseServices = (servicesData || []) as Service[]
        if (baseServices.length === 0) {
            setServices([])
            setLoading(false)
            return
        }

        const serviceIds = baseServices.map(s => s.id)
        const { data: itemsData } = await supabase
            .from('service_items')
            .select('id, service_id, qty, unit_price, articles(nom)')
            .in('service_id', serviceIds)

        const groupedItems = new Map<string, ServiceWithItems['items']>()
        ;((itemsData || []) as any[]).forEach(item => {
            const existing = groupedItems.get(item.service_id) || []
            existing.push({
                id: item.id,
                qty: item.qty,
                unit_price: item.unit_price,
                article_name: item.articles?.nom || '-',
            })
            groupedItems.set(item.service_id, existing)
        })

        setServices(
            baseServices.map(service => ({
                ...service,
                items: groupedItems.get(service.id) || [],
            }))
        )

        setLoading(false)
    }

    const stats = useMemo(() => {
        const totalServices = services.length
        const totalAmount = services.reduce((sum, s) => sum + Number(s.total || 0), 0)
        const rentalCount = services.filter(s => s.type === 'location').length
        const saleCount = services.filter(s => s.type === 'vente').length
        return { totalServices, totalAmount, rentalCount, saleCount }
    }, [services])

    if (loading) return <div className="p-8 text-center text-slate-500">{t('loading')}</div>
    if (!client) return null

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/app/clients')}
                    className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('clientHistory')}</h1>
                    <p className="text-sm text-slate-500">{client.full_name}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-400">{t('services')}</p>
                    <p className="text-xl font-bold text-slate-900 mt-1">{stats.totalServices}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-400">{t('sales')}</p>
                    <p className="text-xl font-bold text-slate-900 mt-1">{stats.saleCount}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-400">{t('rentals')}</p>
                    <p className="text-xl font-bold text-slate-900 mt-1">{stats.rentalCount}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-400">{t('total')}</p>
                    <p className="text-xl font-bold text-slate-900 mt-1">{currency(stats.totalAmount)} DT</p>
                </div>
            </div>

            {services.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500">
                    {t('noClientHistory')}
                </div>
            ) : (
                <div className="space-y-4">
                    {services.map(service => (
                        <div key={service.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                                        <ShoppingBag className="h-3.5 w-3.5" />
                                        {service.type.toUpperCase()}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        {new Date(service.created_at).toLocaleDateString()}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                                        <Receipt className="h-3.5 w-3.5" />
                                        {currency(Number(service.total || 0))} DT
                                    </span>
                                </div>
                                <span className="text-xs font-mono text-slate-400">{service.id.slice(0, 8)}</span>
                            </div>

                            {service.type === 'location' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                                        <p className="text-xs text-slate-400">{t('from')}</p>
                                        <p className="text-sm font-medium text-slate-700">
                                            {service.rental_start ? new Date(service.rental_start).toLocaleDateString() : '-'}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                                        <p className="text-xs text-slate-400">{t('to')}</p>
                                        <p className="text-sm font-medium text-slate-700">
                                            {service.rental_end ? new Date(service.rental_end).toLocaleDateString() : '-'}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                                        <p className="text-xs text-slate-400">{t('deposit')}</p>
                                        <p className="text-sm font-medium text-slate-700">{currency(Number(service.rental_deposit || 0))} DT</p>
                                    </div>
                                </div>
                            )}

                            <div className="border border-slate-100 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="text-left px-3 py-2 font-medium text-slate-500">{t('articles')}</th>
                                            <th className="text-center px-3 py-2 font-medium text-slate-500">{t('qty')}</th>
                                            <th className="text-right px-3 py-2 font-medium text-slate-500">{t('unitPrice')}</th>
                                            <th className="text-right px-3 py-2 font-medium text-slate-500">{t('total')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {service.items.map(item => (
                                            <tr key={item.id}>
                                                <td className="px-3 py-2">{item.article_name}</td>
                                                <td className="px-3 py-2 text-center">{item.qty}</td>
                                                <td className="px-3 py-2 text-right">{currency(item.unit_price)} DT</td>
                                                <td className="px-3 py-2 text-right font-semibold">{currency(item.qty * item.unit_price)} DT</td>
                                            </tr>
                                        ))}
                                        {service.items.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-3 text-center text-slate-400">
                                                    {t('noResults')}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-end">
                <Button variant="secondary" onClick={() => navigate('/app/clients')}>
                    <UserRound className="h-4 w-4" />
                    {t('clients')}
                </Button>
            </div>
        </div>
    )
}
