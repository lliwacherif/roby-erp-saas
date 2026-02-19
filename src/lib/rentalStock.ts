import { supabase } from '@/lib/supabase'

const RENTAL_START_REASON = 'rental_start'

type DueItem = {
  id: string
  article_id: string
  qty: number
}

// For location services, apply stock-out only when each item's rental_start day arrives.
export async function applyDueRentalStarts(tenantId: string) {
  const today = new Date().toISOString().split('T')[0]

  const { data: activeServices } = await supabase
    .from('services')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('type', 'location')
    .eq('status', 'confirmed')

  const serviceIds = (activeServices || []).map((s: any) => s.id).filter(Boolean)
  if (serviceIds.length === 0) return

  const { data: rawDueItems } = await supabase
    .from('service_items')
    .select('id, article_id, qty')
    .in('service_id', serviceIds)
    .not('rental_start', 'is', null)
    .lte('rental_start', today)

  const dueItems = (rawDueItems || []) as DueItem[]
  if (dueItems.length === 0) return

  const itemIds = dueItems.map((i) => i.id)
  const { data: existingStarts } = await supabase
    .from('stock_movements')
    .select('ref_id')
    .eq('tenant_id', tenantId)
    .eq('ref_table', 'service_items')
    .eq('reason', RENTAL_START_REASON)
    .in('ref_id', itemIds)

  const startedIds = new Set((existingStarts || []).map((m: any) => m.ref_id).filter(Boolean))
  const toStart = dueItems.filter((item) => !startedIds.has(item.id))
  if (toStart.length === 0) return

  const movements = toStart.map((item) => ({
    tenant_id: tenantId,
    article_id: item.article_id,
    qty_delta: -item.qty,
    reason: RENTAL_START_REASON,
    ref_table: 'service_items',
    ref_id: item.id,
  }))

  await supabase.from('stock_movements').insert(movements)
}
