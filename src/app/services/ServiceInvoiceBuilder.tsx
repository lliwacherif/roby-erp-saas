import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ArrowLeft, Printer } from 'lucide-react'

type ServiceItem = {
  id: string
  qty: number
  unit_price: number
  article_name: string
  rental_deposit: number | null
  rental_start: string | null
  rental_end: string | null
}

type ServiceData = {
  id: string
  type: 'location' | 'vente'
  status: string
  rental_start: string | null
  rental_end: string | null
  rental_deposit: number | null
  total: number
  created_at: string
}

type ClientData = {
  full_name: string
  phone: string | null
  email: string | null
  cin: string | null
  address: string | null
}

type CompanyProfile = {
  company_name: string
  company_address: string
  company_phone: string
  company_email: string
  company_tax_id: string
}

const emptyProfile: CompanyProfile = {
  company_name: '',
  company_address: '',
  company_phone: '',
  company_email: '',
  company_tax_id: '',
}

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TVA_RATE = 0.19

export default function ServiceInvoiceBuilder() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { currentTenant } = useTenant()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [service, setService] = useState<ServiceData | null>(null)
  const [client, setClient] = useState<ClientData | null>(null)
  const [items, setItems] = useState<ServiceItem[]>([])
  const [profile, setProfile] = useState<CompanyProfile>(emptyProfile)
  const [error, setError] = useState('')
  const [priceMode, setPriceMode] = useState<'TTC' | 'HT'>('TTC')

  useEffect(() => {
    if (currentTenant && id) {
      loadAll()
    }
  }, [currentTenant, id])

  const loadAll = async () => {
    if (!currentTenant || !id) return
    setLoading(true)
    setError('')

    const { data: serviceData, error: serviceError } = await supabase
      .from('services')
      .select('id, type, status, rental_start, rental_end, rental_deposit, total, created_at, client_id')
      .eq('tenant_id', currentTenant.id)
      .eq('id', id)
      .single()

    if (serviceError || !serviceData) {
      setError('Service not found')
      setLoading(false)
      return
    }

    const { data: clientData } = await supabase
      .from('clients')
      .select('full_name, phone, email, cin, address')
      .eq('tenant_id', currentTenant.id)
      .eq('id', serviceData.client_id)
      .single()

    const { data: itemRows } = await supabase
      .from('service_items')
      .select('id, qty, unit_price, rental_deposit, rental_start, rental_end, articles(nom)')
      .eq('service_id', serviceData.id)

    const mappedItems: ServiceItem[] = ((itemRows || []) as any[]).map((r) => ({
      id: r.id,
      qty: r.qty,
      unit_price: r.unit_price,
      article_name: r.articles?.nom || '-',
      rental_deposit: r.rental_deposit ?? null,
      rental_start: r.rental_start ?? null,
      rental_end: r.rental_end ?? null,
    }))

    const { data: profileData } = await supabase
      .from('tenant_company_profiles')
      .select('company_name, company_address, company_phone, company_email, company_tax_id')
      .eq('tenant_id', currentTenant.id)
      .maybeSingle()

    setService(serviceData as ServiceData)
    setClient((clientData as ClientData) || null)
    setItems(mappedItems)
    setProfile({
      company_name: profileData?.company_name || '',
      company_address: profileData?.company_address || '',
      company_phone: profileData?.company_phone || '',
      company_email: profileData?.company_email || '',
      company_tax_id: profileData?.company_tax_id || '',
    })
    setLoading(false)
  }

  const saveCompanyProfile = async () => {
    if (!currentTenant) return
    setSaving(true)
    setError('')

    const { error: upsertError } = await supabase
      .from('tenant_company_profiles')
      .upsert(
        {
          tenant_id: currentTenant.id,
          company_name: profile.company_name || null,
          company_address: profile.company_address || null,
          company_phone: profile.company_phone || null,
          company_email: profile.company_email || null,
          company_tax_id: profile.company_tax_id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      )

    if (upsertError) {
      setError(upsertError.message)
    }
    setSaving(false)
  }

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.qty * item.unit_price, 0),
    [items]
  )
  const totalDeposit = useMemo(
    () => items.reduce((acc, item) => acc + (Number(item.rental_deposit) || 0), 0),
    [items]
  )
  // Mode behavior requested:
  // - TTC mode: entered amounts are treated as TTC (total remains the same)
  // - HT mode: entered amounts are treated as HT (TVA 19% added on top)
  const subtotalHT = priceMode === 'TTC' ? subtotal / (1 + TVA_RATE) : subtotal
  const tvaAmount = priceMode === 'TTC' ? subtotal - subtotalHT : subtotalHT * TVA_RATE
  const subtotalTTC = priceMode === 'TTC' ? subtotal : subtotalHT + tvaAmount

  const displayUnitPrice = (unitPrice: number) => unitPrice
  const displayLineTotal = (qty: number, unitPrice: number) => qty * unitPrice

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>
  if (!service) return <div className="p-8 text-center text-red-500">{error || 'Service not found'}</div>

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-area, .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 12mm !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }
          .print-hidden {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 print-hidden">
          <button
            onClick={() => navigate('/app/services')}
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Generateur de Facture</h1>
            <p className="text-sm text-slate-500">Service #{service.id.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 print-hidden">
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setPriceMode('TTC')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                priceMode === 'TTC'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              TTC
            </button>
            <button
              type="button"
              onClick={() => setPriceMode('HT')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                priceMode === 'HT'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              HT
            </button>
          </div>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 h-fit print-hidden">
          <h2 className="text-sm font-semibold text-slate-800">Details de l'entreprise (enregistrees par locataire)</h2>

          <Input
            label="Nom de l'entreprise"
            value={profile.company_name}
            onChange={(e) => setProfile((p) => ({ ...p, company_name: e.target.value }))}
          />
          <Input
            label="Adresse"
            value={profile.company_address}
            onChange={(e) => setProfile((p) => ({ ...p, company_address: e.target.value }))}
          />
          <Input
            label="Telephone"
            value={profile.company_phone}
            onChange={(e) => setProfile((p) => ({ ...p, company_phone: e.target.value }))}
          />
          <Input
            label="Email"
            value={profile.company_email}
            onChange={(e) => setProfile((p) => ({ ...p, company_email: e.target.value }))}
          />
          <Input
            label="Matricule fiscal / RC"
            value={profile.company_tax_id}
            onChange={(e) => setProfile((p) => ({ ...p, company_tax_id: e.target.value }))}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={saveCompanyProfile} disabled={saving} className="w-full">
            {saving ? 'Enregistrement...' : "Enregistrer les details de l'entreprise"}
          </Button>
        </div>

        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-8 space-y-6 print-area">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">FACTURE</h2>
            <p className="text-sm text-slate-700">Date: {new Date(service.created_at).toLocaleDateString('fr-FR')}</p>
            <p className="text-sm text-slate-700">ID Service: {service.id.slice(0, 8)}</p>
          </div>

          <div className="space-y-1 text-sm text-slate-800">
            <p>{profile.company_name || '-'}</p>
            <p>{profile.company_address || '-'}</p>
            <p>{profile.company_phone || '-'}</p>
            <p>{profile.company_email || '-'}</p>
            <p>{profile.company_tax_id || '-'}</p>
          </div>

          <div className="space-y-1 text-sm text-slate-800">
            <p className="font-semibold">Facture a</p>
            <p>{client?.full_name || '-'}</p>
            <p>{client?.phone || '-'}</p>
            <p>{client?.email || '-'}</p>
            <p>{client?.address || '-'}</p>
          </div>

          <div className="space-y-1 text-sm text-slate-800">
            <p className="font-semibold">Infos Service</p>
            <p>Type: {service.type.toUpperCase()}</p>
            <p>Statut: {service.status.toUpperCase()}</p>
            <p>Du: {service.rental_start ? new Date(service.rental_start).toLocaleDateString('fr-FR') : '-'}</p>
            <p>Au: {service.rental_end ? new Date(service.rental_end).toLocaleDateString('fr-FR') : '-'}</p>
            {service.type === 'location' && <p>Caution: {fmt(totalDeposit > 0 ? totalDeposit : (service.rental_deposit || 0))} DT</p>}
            <p>Mode prix: {priceMode}</p>
            <p>TVA: 19%</p>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">Article</th>
                  <th className="text-center px-4 py-2 font-medium text-slate-500">Qte</th>
                  {service.type === 'location' && (
                    <>
                      <th className="text-right px-4 py-2 font-medium text-slate-500">Caution</th>
                      <th className="text-center px-4 py-2 font-medium text-slate-500">Du</th>
                      <th className="text-center px-4 py-2 font-medium text-slate-500">Au</th>
                    </>
                  )}
                  <th className="text-right px-4 py-2 font-medium text-slate-500">
                    Prix Unitaire {priceMode}
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5">{item.article_name}</td>
                    <td className="px-4 py-2.5 text-center">{item.qty}</td>
                    {service.type === 'location' && (
                      <>
                        <td className="px-4 py-2.5 text-right">{fmt(Number(item.rental_deposit) || 0)} DT</td>
                        <td className="px-4 py-2.5 text-center">
                          {item.rental_start ? new Date(item.rental_start).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {item.rental_end ? new Date(item.rental_end).toLocaleDateString('fr-FR') : '-'}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2.5 text-right">{fmt(displayUnitPrice(item.unit_price))} DT</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{fmt(displayLineTotal(item.qty, item.unit_price))} DT</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan={service.type === 'location' ? 6 : 3} className="px-4 py-2.5 text-right font-semibold text-slate-700">Sous-total HT</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmt(subtotalHT)} DT</td>
                </tr>
                {service.type === 'location' && (
                  <tr>
                    <td colSpan={6} className="px-4 py-2.5 text-right font-semibold text-slate-700">Caution</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                      {fmt(totalDeposit > 0 ? totalDeposit : (service.rental_deposit || 0))} DT
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={service.type === 'location' ? 6 : 3} className="px-4 py-2.5 text-right font-semibold text-slate-700">TVA (19%)</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmt(tvaAmount)} DT</td>
                </tr>
                <tr>
                  <td colSpan={service.type === 'location' ? 6 : 3} className="px-4 py-2.5 text-right font-bold text-slate-900">Total TTC</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-900">{fmt(subtotalTTC)} DT</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="pt-12">
            <p className="text-sm text-slate-900">Cachet et Signature</p>
          </div>
        </div>
      </div>
    </div>
  )
}
