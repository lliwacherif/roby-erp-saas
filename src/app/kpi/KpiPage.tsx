import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Package,
    Users,
    ShoppingCart,
    ArrowUpRight,
    ArrowDownRight,
    BarChart3,
    AlertTriangle,
    Calendar
} from 'lucide-react'

type Period = 'week' | 'month' | 'quarter' | 'year' | 'all'

function getPeriodRange(period: Period): { from: string; label: string } {
    const now = new Date()
    let from: Date

    switch (period) {
        case 'week': {
            from = new Date(now)
            from.setDate(now.getDate() - 7)
            break
        }
        case 'month': {
            from = new Date(now.getFullYear(), now.getMonth(), 1)
            break
        }
        case 'quarter': {
            const qMonth = Math.floor(now.getMonth() / 3) * 3
            from = new Date(now.getFullYear(), qMonth, 1)
            break
        }
        case 'year': {
            from = new Date(now.getFullYear(), 0, 1)
            break
        }
        case 'all':
        default:
            from = new Date(2000, 0, 1)
    }

    return { from: from.toISOString(), label: period }
}

interface KPIData {
    totalEarnings: number
    earningsVente: number
    earningsLocation: number
    totalExpenses: number
    netProfit: number
    totalArticles: number
    totalStockValue: number
    lowStockItems: { nom: string; qte_on_hand: number }[]
    totalClients: number
    totalWorkers: number
    monthlyPayroll: number
    recentServices: { id: string; type: string; total: number; status: string; created_at: string; client_name?: string }[]
    serviceCount: number
}

export default function KpiPage() {
    const { currentTenant } = useTenant()
    const { t } = useI18n()
    const [data, setData] = useState<KPIData | null>(null)
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<Period>('month')

    useEffect(() => {
        if (currentTenant) fetchKPIData()
    }, [currentTenant, period])

    const fetchKPIData = async () => {
        if (!currentTenant) return
        setLoading(true)

        const tid = currentTenant.id
        const { from } = getPeriodRange(period)

        // Build filtered queries based on period
        let servicesQuery = supabase
            .from('services')
            .select('id, type, total, status, created_at, clients(full_name)')
            .eq('tenant_id', tid)
            .eq('status', 'confirmed')
            .order('created_at', { ascending: false })

        let depensesQuery = supabase
            .from('depenses')
            .select('amount, type')
            .eq('tenant_id', tid)

        let salaryPaymentsQuery = supabase
            .from('salary_payments')
            .select('amount, paid_at')
            .eq('tenant_id', tid)

        // Apply date filter unless "all time"
        if (period !== 'all') {
            servicesQuery = servicesQuery.gte('created_at', from)
            depensesQuery = depensesQuery.gte('spent_at', from)
            salaryPaymentsQuery = salaryPaymentsQuery.gte('paid_at', from)
        }

        const safeQuery = async (fn: () => PromiseLike<any>, fallback: any) => {
            try { return await fn() } catch { return fallback }
        }

        const [
            servicesRes,
            depensesRes,
            salaryPaymentsRes,
            stockRes,
            clientsRes,
            ouvriersRes
        ] = await Promise.all([
            safeQuery(() => servicesQuery, { data: [], count: 0 }),
            safeQuery(() => depensesQuery, { data: [] }),
            safeQuery(() => salaryPaymentsQuery, { data: [] }),
            safeQuery(() => supabase.from('v_stock_overview').select('*').eq('tenant_id', tid), { data: [] }),
            safeQuery(() => supabase.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tid), { data: [], count: 0 }),
            safeQuery(() => supabase.from('ouvriers').select('salaire_base').eq('tenant_id', tid), { data: [] })
        ])

        const services = (servicesRes.data || []) as any[]
        const depenses = (depensesRes.data || []) as any[]
        const salaryPayments = (salaryPaymentsRes.data || []) as any[]
        const stock = (stockRes.data || []) as any[]
        const ouvriers = (ouvriersRes.data || []) as any[]

        const earningsVente = services.filter(s => s.type === 'vente').reduce((s, r) => s + (r.total || 0), 0)
        const earningsLocation = services.filter(s => s.type === 'location').reduce((s, r) => s + (r.total || 0), 0)
        const totalEarnings = earningsVente + earningsLocation
        const depensesTotal = depenses.reduce((s, r) => s + (r.amount || 0), 0)
        const salaryPaymentsTotal = salaryPayments.reduce((s, r) => s + (r.amount || 0), 0)
        const totalExpenses = depensesTotal + salaryPaymentsTotal

        const totalStockValue = stock.reduce((s, r) => s + (r.prix_achat || 0) * (r.qte_on_hand || 0), 0)
        const lowStockItems = stock.filter((s: any) => s.qte_on_hand <= 5).sort((a: any, b: any) => a.qte_on_hand - b.qte_on_hand).slice(0, 5)

        const monthlyPayroll = ouvriers.reduce((s, r) => s + (r.salaire_base || 0), 0)

        const recentServices = services.slice(0, 5).map((s: any) => ({
            id: s.id,
            type: s.type,
            total: s.total,
            status: s.status,
            created_at: s.created_at,
            client_name: s.clients?.full_name
        }))

        setData({
            totalEarnings,
            earningsVente,
            earningsLocation,
            totalExpenses,
            netProfit: totalEarnings - totalExpenses,
            totalArticles: stock.length,
            totalStockValue,
            lowStockItems,
            totalClients: clientsRes.count || 0,
            totalWorkers: ouvriers.length,
            monthlyPayroll,
            recentServices,
            serviceCount: services.length,
        })
        setLoading(false)
    }

    const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

    const periods: { key: Period; label: string }[] = [
        { key: 'week', label: t('periodWeek') },
        { key: 'month', label: t('periodMonth') },
        { key: 'quarter', label: t('periodQuarter') },
        { key: 'year', label: t('periodYear') },
        { key: 'all', label: t('periodAll') },
    ]

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-500 font-medium">{t('loading')}</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* ── Header + Period Selector ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('kpiTitle')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{t('kpiSubtitle')}</p>
                </div>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm overflow-x-auto min-w-0 max-w-full hide-scrollbar">
                    <Calendar className="h-4 w-4 text-slate-400 ml-2 mr-1 shrink-0" />
                    {periods.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${period === p.key
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Top KPI Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Earnings */}
                <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-5 shadow-sm group hover:shadow-md hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-500">{t('totalEarnings')}</span>
                        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{fmt(data.totalEarnings)} <span className="text-sm font-medium text-slate-400">DT</span></p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-emerald-600 font-medium">{t('sales')}: {fmt(data.earningsVente)} DT</span>
                        <span className="text-blue-600 font-medium">{t('rentals')}: {fmt(data.earningsLocation)} DT</span>
                    </div>
                    <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-emerald-50 opacity-60" />
                </div>

                {/* Total Expenses */}
                <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-5 shadow-sm group hover:shadow-md hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-500">{t('totalExpenses')}</span>
                        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-red-100 text-red-600">
                            <TrendingDown className="h-5 w-5" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{fmt(data.totalExpenses)} <span className="text-sm font-medium text-slate-400">DT</span></p>
                    <div className="mt-2 text-xs text-slate-400">
                        {data.serviceCount} {t('services').toLowerCase()} · {data.totalWorkers} {t('workers').toLowerCase()}
                    </div>
                    <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-red-50 opacity-60" />
                </div>

                {/* Net Profit */}
                <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-5 shadow-sm group hover:shadow-md hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-500">{t('netProfit')}</span>
                        <div className={`flex items-center justify-center h-10 w-10 rounded-xl ${data.netProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            <Wallet className="h-5 w-5" />
                        </div>
                    </div>
                    <p className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {data.netProfit >= 0 ? '+' : ''}{fmt(data.netProfit)} <span className="text-sm font-medium opacity-60">DT</span>
                    </p>
                    <div className={`absolute -bottom-4 -right-4 h-24 w-24 rounded-full ${data.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'} opacity-60`} />
                </div>

                {/* Stock Value */}
                <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-5 shadow-sm group hover:shadow-md hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-500">{t('stockValue')}</span>
                        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-100 text-blue-600">
                            <Package className="h-5 w-5" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{fmt(data.totalStockValue)} <span className="text-sm font-medium text-slate-400">DT</span></p>
                    <div className="mt-2 text-xs text-slate-400">
                        {data.totalArticles} {t('articles').toLowerCase()}
                    </div>
                    <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-blue-50 opacity-60" />
                </div>
            </div>

            {/* ── P&L Breakdown + Quick Stats ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* P&L Breakdown */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-5">
                        <BarChart3 className="h-5 w-5 text-slate-400" />
                        <h2 className="text-lg font-semibold text-slate-900">{t('periodOverview')}</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-emerald-50 rounded-xl p-4">
                            <div className="flex items-center gap-1.5 mb-1">
                                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                                <span className="text-xs font-medium text-emerald-700">{t('totalEarnings')}</span>
                            </div>
                            <p className="text-xl font-bold text-emerald-700">{fmt(data.totalEarnings)} DT</p>
                        </div>
                        <div className="bg-red-50 rounded-xl p-4">
                            <div className="flex items-center gap-1.5 mb-1">
                                <ArrowDownRight className="h-4 w-4 text-red-600" />
                                <span className="text-xs font-medium text-red-700">{t('totalExpenses')}</span>
                            </div>
                            <p className="text-xl font-bold text-red-700">{fmt(data.totalExpenses)} DT</p>
                        </div>
                        <div className={`rounded-xl p-4 ${data.netProfit >= 0 ? 'bg-blue-50' : 'bg-amber-50'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <Wallet className={`h-4 w-4 ${data.netProfit >= 0 ? 'text-blue-600' : 'text-amber-600'}`} />
                                <span className={`text-xs font-medium ${data.netProfit >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>{t('netProfit')}</span>
                            </div>
                            <p className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                                {data.netProfit >= 0 ? '+' : ''}{fmt(data.netProfit)} DT
                            </p>
                        </div>
                    </div>

                    {/* Payroll Info */}
                    <div className="mt-5 flex items-center gap-4 bg-slate-50 rounded-xl p-4">
                        <Users className="h-5 w-5 text-slate-400" />
                        <div>
                            <p className="text-sm font-medium text-slate-700">{t('monthlyPayroll')}</p>
                            <p className="text-xs text-slate-400">{data.totalWorkers} {t('workers').toLowerCase()}</p>
                        </div>
                        <p className="ml-auto text-lg font-bold text-slate-900">{fmt(data.monthlyPayroll)} DT</p>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900">{t('quickStats')}</h2>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Package className="h-4 w-4 text-blue-600" />
                                </div>
                                <span className="text-sm font-medium text-slate-700">{t('articles')}</span>
                            </div>
                            <span className="text-lg font-bold text-slate-900">{data.totalArticles}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <Users className="h-4 w-4 text-purple-600" />
                                </div>
                                <span className="text-sm font-medium text-slate-700">{t('clients')}</span>
                            </div>
                            <span className="text-lg font-bold text-slate-900">{data.totalClients}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                                    <ShoppingCart className="h-4 w-4 text-emerald-600" />
                                </div>
                                <span className="text-sm font-medium text-slate-700">{t('services')}</span>
                            </div>
                            <span className="text-lg font-bold text-slate-900">{data.serviceCount}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                                    <Users className="h-4 w-4 text-amber-600" />
                                </div>
                                <span className="text-sm font-medium text-slate-700">{t('workers')}</span>
                            </div>
                            <span className="text-lg font-bold text-slate-900">{data.totalWorkers}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Bottom Row: Recent Services + Low Stock ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Recent Services */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('recentServices')}</h2>
                    {data.recentServices.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">{t('noResults')}</p>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {data.recentServices.map(svc => (
                                <div key={svc.id} className="flex items-center justify-between py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">{svc.client_name || '—'}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                {svc.type.toUpperCase()}
                                            </span>
                                            <span className="text-xs text-slate-400">{new Date(svc.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <span className="font-semibold text-slate-900 text-sm whitespace-nowrap">{fmt(svc.total)} DT</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Low Stock Alert */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <h2 className="text-lg font-semibold text-slate-900">{t('lowStockAlert')}</h2>
                    </div>
                    {data.lowStockItems.length === 0 ? (
                        <div className="text-center py-6">
                            <Package className="h-10 w-10 text-emerald-200 mx-auto mb-2" />
                            <p className="text-sm text-emerald-600 font-medium">{t('allStockGood')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {data.lowStockItems.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-amber-50">
                                    <span className="text-sm font-medium text-slate-700 truncate">{item.nom}</span>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${item.qte_on_hand <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                        {item.qte_on_hand} {t('inStock')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
