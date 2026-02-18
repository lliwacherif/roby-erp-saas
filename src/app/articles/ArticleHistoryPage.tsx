import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import type { Database } from '@/types/db'

type Article = Database['public']['Tables']['articles']['Row']

type ArticlePerformance = {
  id: string
  nom: string
  photo_url: string | null
  qte_on_hand: number
  prix_achat: number
  prix_location_min: number
  prix_location_max: number
  services_count: number
  ventes_count: number
  locations_count: number
  qty_total: number
  revenue_total: number
  estimated_cost_total: number
  article_expenses_total: number
  net_profit: number
  margin_percent: number
}

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ArticleHistoryPage() {
  const navigate = useNavigate()
  const { currentTenant } = useTenant()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ArticlePerformance[]>([])

  useEffect(() => {
    if (currentTenant) void fetchHistory()
  }, [currentTenant])

  const fetchHistory = async () => {
    if (!currentTenant) return
    setLoading(true)

    const { data: articlesData } = await supabase
      .from('articles')
      .select('id, nom, photo_url, qte_on_hand, prix_achat, prix_location_min, prix_location_max')
      .eq('tenant_id', currentTenant.id)

    const articles = (articlesData || []) as Article[]

    const { data: serviceItemsData } = await supabase
      .from('service_items')
      .select('service_id, article_id, qty, unit_price, services(status, type)')
      .eq('tenant_id', currentTenant.id)

    const { data: depensesData } = await supabase
      .from('depenses')
      .select('article_id, amount')
      .eq('tenant_id', currentTenant.id)
      .not('article_id', 'is', null)

    const perArticle = new Map<string, ArticlePerformance>()

    for (const article of articles) {
      perArticle.set(article.id, {
        id: article.id,
        nom: article.nom,
        photo_url: article.photo_url,
        qte_on_hand: article.qte_on_hand,
        prix_achat: Number(article.prix_achat || 0),
        prix_location_min: Number(article.prix_location_min || 0),
        prix_location_max: Number(article.prix_location_max || 0),
        services_count: 0,
        ventes_count: 0,
        locations_count: 0,
        qty_total: 0,
        revenue_total: 0,
        estimated_cost_total: 0,
        article_expenses_total: 0,
        net_profit: 0,
        margin_percent: 0,
      })
    }

    const servicePerArticle = new Map<string, Set<string>>()
    const ventesPerArticle = new Map<string, Set<string>>()
    const locationsPerArticle = new Map<string, Set<string>>()

    ;((serviceItemsData || []) as any[]).forEach((item) => {
      const perf = perArticle.get(item.article_id)
      if (!perf) return

      const status = item.services?.status
      if (status === 'cancelled') return

      const qty = Number(item.qty || 0)
      const unitPrice = Number(item.unit_price || 0)

      perf.qty_total += qty
      perf.revenue_total += qty * unitPrice
      perf.estimated_cost_total += qty * Number(perf.prix_achat || 0)

      if (!servicePerArticle.has(item.article_id)) servicePerArticle.set(item.article_id, new Set())
      servicePerArticle.get(item.article_id)!.add(item.service_id)

      const type = item.services?.type
      if (type === 'vente') {
        if (!ventesPerArticle.has(item.article_id)) ventesPerArticle.set(item.article_id, new Set())
        ventesPerArticle.get(item.article_id)!.add(item.service_id)
      }
      if (type === 'location') {
        if (!locationsPerArticle.has(item.article_id)) locationsPerArticle.set(item.article_id, new Set())
        locationsPerArticle.get(item.article_id)!.add(item.service_id)
      }
    })

    ;((depensesData || []) as any[]).forEach((dep) => {
      const perf = perArticle.get(dep.article_id)
      if (!perf) return
      perf.article_expenses_total += Number(dep.amount || 0)
    })

    const result = Array.from(perArticle.values()).map((perf) => {
      perf.services_count = servicePerArticle.get(perf.id)?.size || 0
      perf.ventes_count = ventesPerArticle.get(perf.id)?.size || 0
      perf.locations_count = locationsPerArticle.get(perf.id)?.size || 0
      perf.net_profit = perf.revenue_total - perf.estimated_cost_total - perf.article_expenses_total
      perf.margin_percent = perf.revenue_total > 0 ? (perf.net_profit / perf.revenue_total) * 100 : 0
      return perf
    })

    setRows(result)
    setLoading(false)
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.revenue += r.revenue_total
        acc.cost += r.estimated_cost_total
        acc.expenses += r.article_expenses_total
        acc.profit += r.net_profit
        return acc
      },
      { revenue: 0, cost: 0, expenses: 0, profit: 0 }
    )
  }, [rows])

  const columns: ColumnDef<ArticlePerformance>[] = [
    {
      accessorKey: 'photo_url',
      header: 'Photo',
      cell: ({ row }) => {
        const photo = row.original.photo_url
        if (!photo) return <span className="text-xs text-slate-400">-</span>
        return (
          <div className="h-10 w-10 rounded-md overflow-hidden border border-slate-200 bg-slate-50">
            <img src={photo} alt={row.original.nom} className="h-full w-full object-cover" />
          </div>
        )
      },
    },
    { accessorKey: 'nom', header: 'Article' },
    { accessorKey: 'qte_on_hand', header: 'Stock actuel' },
    { accessorKey: 'prix_achat', header: "Prix d'achat" },
    { accessorKey: 'prix_location_min', header: 'Location min' },
    { accessorKey: 'prix_location_max', header: 'Location max' },
    { accessorKey: 'services_count', header: 'Nb services' },
    { accessorKey: 'ventes_count', header: 'Nb ventes' },
    { accessorKey: 'locations_count', header: 'Nb locations' },
    { accessorKey: 'qty_total', header: 'Qte totale sortie' },
    {
      accessorKey: 'revenue_total',
      header: "CA total",
      cell: ({ row }) => <span>{fmt(row.original.revenue_total)} DT</span>,
    },
    {
      accessorKey: 'estimated_cost_total',
      header: 'Cout estime',
      cell: ({ row }) => <span>{fmt(row.original.estimated_cost_total)} DT</span>,
    },
    {
      accessorKey: 'article_expenses_total',
      header: 'Depenses article',
      cell: ({ row }) => <span>{fmt(row.original.article_expenses_total)} DT</span>,
    },
    {
      accessorKey: 'net_profit',
      header: 'Benefice net',
      cell: ({ row }) => {
        const val = row.original.net_profit
        return <span className={val >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{fmt(val)} DT</span>
      },
    },
    {
      accessorKey: 'margin_percent',
      header: 'Marge %',
      cell: ({ row }) => <span>{fmt(row.original.margin_percent)}%</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app/articles')}
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Historique Articles</h1>
            <p className="text-sm text-slate-500">Performance detaillee de chaque article</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400">CA total</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{fmt(totals.revenue)} DT</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400">Cout estime</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{fmt(totals.cost)} DT</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400">Depenses article</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{fmt(totals.expenses)} DT</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400">Benefice net global</p>
          <p className={`text-lg font-bold mt-1 ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmt(totals.profit)} DT
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Chargement...</div>
        ) : (
          <DataTable columns={columns} data={rows} searchKey="nom" />
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => navigate('/app/articles')}>
          <TrendingUp className="h-4 w-4" />
          Retour Articles
        </Button>
      </div>
    </div>
  )
}
