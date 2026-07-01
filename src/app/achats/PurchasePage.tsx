import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { InvoicePrintStyles, InvoiceTemplate, formatInvoiceStatusLabel, type InvoiceColumn, type InvoiceRow, type InvoiceTotalRow } from '@/components/invoice/InvoiceTemplate'
import { clsx } from 'clsx'
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  Eye,
  FileText,
  PackagePlus,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react'

type Supplier = {
  id: string
  nom: string
  email?: string | null
  telephone?: string | null
  adresse?: string | null
  immatricule_fiscale?: string | null
}

type Family = { id: string; name: string }
type Category = { id: string; name: string; famille_id: string }
type Article = {
  id: string
  nom: string
  famille_id: string
  category_id: string
  prix_achat: number
  qte_on_hand: number
}

type PurchaseOrder = {
  id: string
  tenant_id: string
  fournisseur_id: string
  supplier_name?: string
  status: string
  total_ht: number
  total_ttc: number
  notes: string | null
  created_at: string
}

type PurchaseOrderItem = {
  id: string
  purchase_order_id: string
  article_id: string
  article_name: string
  qty_ordered: number
  qty_received: number
  remaining_qty: number
  unit_price: number
}

type Receipt = {
  id: string
  tenant_id: string
  purchase_order_id: string
  fournisseur_id: string
  supplier_name?: string
  status: string
  received_at: string
  notes: string | null
  created_at: string
}

type ReceiptItem = {
  id: string
  purchase_receipt_id: string
  purchase_order_item_id: string
  article_id: string
  article_name: string
  qty_received: number
  qty_returned: number
  returnable_qty: number
  unit_price: number
  lot_number: string
  expiry_date: string
}

type PurchaseInvoice = {
  id: string
  fournisseur_id: string
  supplier_name?: string
  purchase_order_id: string | null
  purchase_receipt_id: string | null
  purchase_return_id: string | null
  kind: 'invoice' | 'credit_note'
  invoice_number: string | null
  invoice_date: string
  total_ttc: number
  document_path: string | null
  document_url: string | null
  status: string
  created_at: string
}

type PurchaseReturn = {
  id: string
  purchase_receipt_id: string
  fournisseur_id: string
  supplier_name?: string
  status: string
  returned_at: string
  reason: string | null
  credit_invoice_id: string | null
  created_at: string
}

type OrderLineDraft = {
  category_id: string
  famille_id: string
  article_name: string
  qty: number
  unit_price: number
}

type ReceiptLineDraft = PurchaseOrderItem & {
  qty_to_receive: number
  lot_number: string
  expiry_date: string
}

type ReturnLineDraft = ReceiptItem & {
  qty_to_return: number
  reason: string
}

type CompanyProfile = {
  company_name: string
  company_address: string
  company_phone: string
  company_email: string
  company_tax_id: string
}

type ConfirmState = {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => Promise<void> | void
} | null

const emptyProfile: CompanyProfile = {
  company_name: '',
  company_address: '',
  company_phone: '',
  company_email: '',
  company_tax_id: '',
}

const selectClass =
  'block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400'

const textareaClass =
  'block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none min-h-[96px]'

const fmt = (value: number) =>
  Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const today = () => new Date().toISOString().split('T')[0]
const dateFmt = (value?: string | null) => value ? new Date(value).toLocaleDateString('fr-FR') : '-'

const emptyOrderLine = (): OrderLineDraft => ({
  category_id: '',
  famille_id: '',
  article_name: '',
  qty: 1,
  unit_price: 0,
})

const statusBadgeLabel = (status: string) => formatInvoiceStatusLabel(status)

const statusBadge = (status: string) => {
  switch (status) {
    case 'recu':
    case 'validated':
    case 'matched':
      return 'bg-emerald-100 text-emerald-700'
    case 'partiellement_recu':
    case 'recorded':
      return 'bg-blue-100 text-blue-700'
    case 'disputed':
      return 'bg-red-100 text-red-700'
    case 'annule':
    case 'cancelled':
      return 'bg-slate-100 text-slate-500'
    default:
      return 'bg-amber-100 text-amber-700'
  }
}

export default function PurchasePage() {
  const { currentTenant } = useTenant()
  const db = supabase as any

  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'receipts' | 'invoices' | 'returns'>('dashboard')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [returns, setReturns] = useState<PurchaseReturn[]>([])
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([])
  const [invoiceItems, setInvoiceItems] = useState<PurchaseOrderItem[]>([])
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([])
  const [error, setError] = useState('')

  const [orderSupplierId, setOrderSupplierId] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [orderLines, setOrderLines] = useState<OrderLineDraft[]>([emptyOrderLine()])

  const [selectedReceiptOrderId, setSelectedReceiptOrderId] = useState('')
  const [receiptDate, setReceiptDate] = useState(today())
  const [receiptNotes, setReceiptNotes] = useState('')
  const [receiptLines, setReceiptLines] = useState<ReceiptLineDraft[]>([])

  const [invoiceForm, setInvoiceForm] = useState({
    fournisseur_id: '',
    purchase_order_id: '',
    purchase_receipt_id: '',
    invoice_number: '',
    invoice_date: today(),
    total_ttc: 0,
  })
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [priceMode, setPriceMode] = useState<'TTC' | 'HT'>('TTC')
  const [selectedReviewInvoice, setSelectedReviewInvoice] = useState<PurchaseInvoice | null>(null)
  const [profile, setProfile] = useState<CompanyProfile>(emptyProfile)
  const [profileSaving, setProfileSaving] = useState(false)
  const [isCompanyProfileOpen, setIsCompanyProfileOpen] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [confirming, setConfirming] = useState(false)

  const [selectedReturnReceiptId, setSelectedReturnReceiptId] = useState('')
  const [returnDate, setReturnDate] = useState(today())
  const [returnReason, setReturnReason] = useState('')
  const [creditNoteNumber, setCreditNoteNumber] = useState('')
  const [creditAmountTtc, setCreditAmountTtc] = useState(0)
  const [returnLines, setReturnLines] = useState<ReturnLineDraft[]>([])

  useEffect(() => {
    if (currentTenant) fetchAll()
  }, [currentTenant])

  useEffect(() => {
    if (!currentTenant || !selectedReceiptOrderId) {
      setReceiptLines([])
      return
    }
    loadOrderItemsForReceipt(selectedReceiptOrderId)
  }, [currentTenant, selectedReceiptOrderId])

  useEffect(() => {
    if (!currentTenant || !invoiceForm.purchase_order_id) {
      setInvoiceItems([])
      return
    }
    loadInvoiceItems(invoiceForm.purchase_order_id)
  }, [currentTenant, invoiceForm.purchase_order_id])

  useEffect(() => {
    if (!currentTenant || !selectedReturnReceiptId) {
      setReturnLines([])
      return
    }
    loadReceiptItemsForReturn(selectedReturnReceiptId)
  }, [currentTenant, selectedReturnReceiptId])

  const fetchAll = async () => {
    if (!currentTenant) return
    setLoading(true)
    setError('')
    await Promise.all([
      fetchSuppliers(),
      fetchCompanyProfile(),
      fetchArticleMetadata(),
      fetchOrders(),
      fetchReceipts(),
      fetchInvoices(),
      fetchReturns(),
    ])
    setLoading(false)
  }

  const fetchSuppliers = async () => {
    if (!currentTenant) return
    const { data, error: supplierError } = await supabase
      .from('fournisseurs')
      .select('id, nom, email, telephone, adresse, immatricule_fiscale')
      .eq('tenant_id', currentTenant.id)
      .order('nom')
    if (supplierError) setError(supplierError.message)
    setSuppliers((data || []) as Supplier[])
  }

  const fetchCompanyProfile = async () => {
    if (!currentTenant) return
    const { data } = await supabase
      .from('tenant_company_profiles')
      .select('company_name, company_address, company_phone, company_email, company_tax_id')
      .eq('tenant_id', currentTenant.id)
      .maybeSingle()

    setProfile({
      company_name: data?.company_name || '',
      company_address: data?.company_address || '',
      company_phone: data?.company_phone || '',
      company_email: data?.company_email || '',
      company_tax_id: data?.company_tax_id || '',
    })
  }

  const fetchArticleMetadata = async () => {
    if (!currentTenant) return
    const [{ data: familyRows }, { data: categoryRows }, { data: articleRows }] = await Promise.all([
      supabase.from('famille_articles').select('id, name').eq('tenant_id', currentTenant.id).order('name'),
      supabase.from('article_categories').select('id, name, famille_id').eq('tenant_id', currentTenant.id).order('name'),
      db
        .from('v_stock_overview')
        .select('id, nom, famille_id, category_id, prix_achat, qte_on_hand')
        .eq('tenant_id', currentTenant.id)
        .order('nom'),
    ])
    setFamilies((familyRows || []) as Family[])
    setCategories((categoryRows || []) as Category[])
    setArticles((articleRows || []) as Article[])
  }

  const fetchOrders = async () => {
    if (!currentTenant) return
    const { data, error: orderError } = await db
      .from('purchase_orders')
      .select('*, fournisseurs(nom)')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false })
    if (orderError) {
      setError(orderError.message)
      return
    }
    setOrders(((data || []) as any[]).map((row) => ({
      ...row,
      supplier_name: row.fournisseurs?.nom,
      total_ht: Number(row.total_ht || 0),
      total_ttc: Number(row.total_ttc || 0),
    })))
  }

  const fetchReceipts = async () => {
    if (!currentTenant) return
    const { data, error: receiptError } = await db
      .from('purchase_receipts')
      .select('*, fournisseurs(nom)')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false })
    if (receiptError) {
      setError(receiptError.message)
      return
    }
    setReceipts(((data || []) as any[]).map((row) => ({ ...row, supplier_name: row.fournisseurs?.nom })))
  }

  const fetchInvoices = async () => {
    if (!currentTenant) return
    const { data, error: invoiceError } = await db
      .from('purchase_invoices')
      .select('*, fournisseurs(nom)')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false })
    if (invoiceError) {
      setError(invoiceError.message)
      return
    }
    setInvoices(((data || []) as any[]).map((row) => ({
      ...row,
      supplier_name: row.fournisseurs?.nom,
      total_ttc: Number(row.total_ttc || 0),
    })))
  }

  const fetchReturns = async () => {
    if (!currentTenant) return
    const { data, error: returnError } = await db
      .from('purchase_returns')
      .select('*, fournisseurs(nom)')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false })
    if (returnError) {
      setError(returnError.message)
      return
    }
    setReturns(((data || []) as any[]).map((row) => ({ ...row, supplier_name: row.fournisseurs?.nom })))
  }

  const getReceivedQtyByOrderItem = async (itemIds: string[]) => {
    if (!itemIds.length) return new Map<string, number>()
    const { data } = await db
      .from('purchase_receipt_items')
      .select('purchase_order_item_id, qty_received, purchase_receipts!inner(status)')
      .in('purchase_order_item_id', itemIds)
      .eq('purchase_receipts.status', 'validated')

    return ((data || []) as any[]).reduce((acc, row) => {
      acc.set(row.purchase_order_item_id, (acc.get(row.purchase_order_item_id) || 0) + Number(row.qty_received || 0))
      return acc
    }, new Map<string, number>())
  }

  const loadOrderItems = async (orderId: string) => {
    if (!currentTenant || !orderId) {
      setOrderItems([])
      return []
    }

    const { data, error: itemError } = await db
      .from('purchase_order_items')
      .select('*, articles(nom)')
      .eq('tenant_id', currentTenant.id)
      .eq('purchase_order_id', orderId)
      .order('created_at')

    if (itemError) throw itemError

    const rows = (data || []) as any[]
    const receivedMap = await getReceivedQtyByOrderItem(rows.map((row) => row.id))
    const mapped = rows.map((row) => {
      const received = receivedMap.get(row.id) || 0
      return {
        id: row.id,
        purchase_order_id: row.purchase_order_id,
        article_id: row.article_id,
        article_name: row.articles?.nom || '-',
        qty_ordered: Number(row.qty_ordered || 0),
        qty_received: received,
        remaining_qty: Math.max(0, Number(row.qty_ordered || 0) - received),
        unit_price: Number(row.unit_price || 0),
      }
    })
    setOrderItems(mapped)
    return mapped
  }

  const loadOrderItemsForReceipt = async (orderId: string) => {
    const mapped = await loadOrderItems(orderId)
    setReceiptLines(mapped.map((item) => ({
      ...item,
      qty_to_receive: item.remaining_qty,
      lot_number: '',
      expiry_date: '',
    })))
  }

  const loadInvoiceItems = async (orderId: string) => {
    const mapped = await loadOrderItems(orderId)
    setInvoiceItems(mapped)
  }

  const loadReceiptItemsForReturn = async (receiptId: string) => {
    if (!currentTenant || !receiptId) return
    const { data, error: itemError } = await db
      .from('purchase_receipt_items')
      .select('*, articles(nom)')
      .eq('tenant_id', currentTenant.id)
      .eq('purchase_receipt_id', receiptId)
      .order('created_at')
    if (itemError) {
      setError(itemError.message)
      return
    }

    const rows = (data || []) as any[]
    const ids = rows.map((row) => row.id)
    const { data: returnedRows } = ids.length
      ? await db
        .from('purchase_return_items')
        .select('purchase_receipt_item_id, qty_returned, purchase_returns!inner(status)')
        .in('purchase_receipt_item_id', ids)
        .eq('purchase_returns.status', 'validated')
      : { data: [] }

    const returnedMap = ((returnedRows || []) as any[]).reduce((acc, row) => {
      acc.set(row.purchase_receipt_item_id, (acc.get(row.purchase_receipt_item_id) || 0) + Number(row.qty_returned || 0))
      return acc
    }, new Map<string, number>())

    const mapped: ReturnLineDraft[] = rows.map((row) => {
      const returnedQty = returnedMap.get(row.id) || 0
      const receivedQty = Number(row.qty_received || 0)
      return {
        id: row.id,
        purchase_receipt_id: row.purchase_receipt_id,
        purchase_order_item_id: row.purchase_order_item_id,
        article_id: row.article_id,
        article_name: row.articles?.nom || '-',
        qty_received: receivedQty,
        qty_returned: returnedQty,
        returnable_qty: Math.max(0, receivedQty - returnedQty),
        unit_price: Number(row.unit_price || 0),
        lot_number: row.lot_number,
        expiry_date: row.expiry_date,
        qty_to_return: 0,
        reason: '',
      }
    })
    setReceiptItems(mapped)
    setReturnLines(mapped)
  }

  const updateOrderLine = (index: number, patch: Partial<OrderLineDraft>) => {
    setOrderLines((lines) => lines.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const handleCategoryChange = (index: number, categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId)
    updateOrderLine(index, {
      category_id: categoryId,
      famille_id: category?.famille_id || '',
      article_name: '',
    })
  }

  const resolveArticle = async (line: OrderLineDraft) => {
    if (!currentTenant) throw new Error('Tenant missing')
    const articleName = line.article_name.trim()
    const existing = articles.find((article) =>
      article.nom.trim().toLowerCase() === articleName.toLowerCase()
      && article.category_id === line.category_id
      && article.famille_id === line.famille_id
    )

    if (existing) {
      await supabase
        .from('articles')
        .update({
          prix_achat: line.unit_price,
          fournisseur_id: orderSupplierId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('tenant_id', currentTenant.id)
      return existing.id
    }

    const { data, error: insertError } = await supabase
      .from('articles')
      .insert({
        tenant_id: currentTenant.id,
        famille_id: line.famille_id,
        category_id: line.category_id,
        fournisseur_id: orderSupplierId || null,
        nom: articleName,
        prix_achat: line.unit_price,
        prix_vente_detail: 0,
        prix_vente_semi_gros: 0,
        prix_vente_gros: 0,
        prix_location_min: 0,
        prix_location_max: 0,
        qte_on_hand: 0,
      })
      .select('id')
      .single()

    if (insertError) throw insertError
    return data.id
  }

  const handleCreateOrder = async () => {
    if (!currentTenant) return
    setSaving(true)
    setError('')

    try {
      if (!orderSupplierId) throw new Error('Selectionnez un fournisseur.')
      if (!orderLines.length) throw new Error('Ajoutez au moins un article.')

      const usableLines = orderLines.map((line) => ({
        ...line,
        qty: Number(line.qty || 0),
        unit_price: Number(line.unit_price || 0),
        article_name: line.article_name.trim(),
      }))

      for (const line of usableLines) {
        if (!line.category_id) throw new Error('La categorie est obligatoire pour chaque ligne.')
        if (!line.famille_id) throw new Error('La famille est obligatoire pour chaque ligne.')
        if (!line.article_name) throw new Error("Le nom de l'article est obligatoire.")
        if (line.qty <= 0) throw new Error('La quantite doit etre superieure a 0.')
        if (line.unit_price < 0) throw new Error('Le prix unitaire doit etre positif.')
      }

      const resolvedItems = []
      for (const line of usableLines) {
        const articleId = await resolveArticle(line)
        resolvedItems.push({ ...line, article_id: articleId })
      }

      const total = resolvedItems.reduce((acc, line) => acc + line.qty * line.unit_price, 0)
      const { data: createdOrder, error: orderError } = await db
        .from('purchase_orders')
        .insert({
          tenant_id: currentTenant.id,
          fournisseur_id: orderSupplierId,
          status: 'en_attente_reception',
          total_ht: total,
          total_ttc: total,
          notes: orderNotes || null,
        })
        .select('id')
        .single()

      if (orderError) throw orderError

      const { error: itemsError } = await db.from('purchase_order_items').insert(
        resolvedItems.map((line) => ({
          tenant_id: currentTenant.id,
          purchase_order_id: createdOrder.id,
          article_id: line.article_id,
          qty_ordered: line.qty,
          unit_price: line.unit_price,
        }))
      )
      if (itemsError) throw itemsError

      setOrderSupplierId('')
      setOrderNotes('')
      setOrderLines([emptyOrderLine()])
      await Promise.all([fetchArticleMetadata(), fetchOrders()])
      setActiveTab('receipts')
      setSelectedReceiptOrderId(createdOrder.id)
    } catch (e: any) {
      setError(e.message)
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleValidateReceipt = async () => {
    if (!currentTenant) return
    const order = orders.find((item) => item.id === selectedReceiptOrderId)
    setSaving(true)
    setError('')

    try {
      if (!order) throw new Error('Selectionnez un bon de commande.')
      const linesToReceive = receiptLines.filter((line) => Number(line.qty_to_receive || 0) > 0)
      if (!linesToReceive.length) throw new Error('Saisissez au moins une quantite recue.')

      for (const line of linesToReceive) {
        if (line.qty_to_receive > line.remaining_qty) {
          throw new Error(`${line.article_name}: la quantite recue depasse le reste a recevoir.`)
        }
        if (!line.lot_number.trim()) throw new Error(`${line.article_name}: numero de lot obligatoire.`)
        if (!line.expiry_date) throw new Error(`${line.article_name}: DLC/DLUO obligatoire.`)
      }

      const { data: createdReceipt, error: receiptError } = await db
        .from('purchase_receipts')
        .insert({
          tenant_id: currentTenant.id,
          purchase_order_id: order.id,
          fournisseur_id: order.fournisseur_id,
          status: 'draft',
          received_at: receiptDate,
          notes: receiptNotes || null,
        })
        .select('id')
        .single()
      if (receiptError) throw receiptError

      const { error: itemError } = await db.from('purchase_receipt_items').insert(
        linesToReceive.map((line) => ({
          tenant_id: currentTenant.id,
          purchase_receipt_id: createdReceipt.id,
          purchase_order_item_id: line.id,
          article_id: line.article_id,
          qty_received: Number(line.qty_to_receive || 0),
          unit_price: line.unit_price,
          lot_number: line.lot_number.trim(),
          expiry_date: line.expiry_date,
        }))
      )
      if (itemError) throw itemError

      const { error: validateError } = await db
        .from('purchase_receipts')
        .update({ status: 'validated' })
        .eq('id', createdReceipt.id)
        .eq('tenant_id', currentTenant.id)
      if (validateError) throw validateError

      setSelectedReceiptOrderId('')
      setReceiptNotes('')
      setReceiptDate(today())
      setReceiptLines([])
      await Promise.all([fetchOrders(), fetchReceipts(), fetchArticleMetadata()])
      setActiveTab('invoices')
      setInvoiceForm((form) => ({
        ...form,
        fournisseur_id: order.fournisseur_id,
        purchase_order_id: order.id,
        purchase_receipt_id: createdReceipt.id,
        total_ttc: order.total_ttc,
      }))
    } catch (e: any) {
      setError(e.message)
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleInvoiceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    if (!file) {
      setInvoiceFile(null)
      return
    }
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('Seuls les PDF et images sont acceptes.')
      event.target.value = ''
      return
    }
    setInvoiceFile(file)
  }

  const handleSaveInvoice = async () => {
    if (!currentTenant) return
    setSaving(true)
    setError('')

    try {
      if (!invoiceForm.fournisseur_id) throw new Error('Selectionnez un fournisseur.')
      if (!invoiceForm.invoice_date) throw new Error("La date d'achat est obligatoire.")
      if (!invoiceForm.purchase_order_id || !invoiceForm.purchase_receipt_id) {
        throw new Error('Liez la facture au BC et au BR correspondants.')
      }
      if (Number(invoiceForm.total_ttc || 0) <= 0) throw new Error('Le montant total TTC doit etre superieur a 0.')

      let documentPath: string | null = null
      let documentUrl: string | null = null

      if (invoiceFile) {
        const ext = invoiceFile.name.includes('.') ? invoiceFile.name.split('.').pop() : 'bin'
        const safeName = invoiceFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')
        documentPath = `${currentTenant.id}/purchase-invoices/${Date.now()}-${safeName || `invoice.${ext}`}`
        const { error: uploadError } = await supabase.storage
          .from('purchase-invoices')
          .upload(documentPath, invoiceFile, { upsert: false, contentType: invoiceFile.type })
        if (uploadError) {
          if (/bucket not found/i.test(uploadError.message)) {
            throw new Error('Bucket "purchase-invoices" manquant. Executez sql/purchase_module.sql dans Supabase.')
          }
          throw uploadError
        }
        const { data: urlData } = supabase.storage.from('purchase-invoices').getPublicUrl(documentPath)
        documentUrl = urlData.publicUrl
      }

      const { data: insertedInvoice, error: invoiceError } = await db.from('purchase_invoices').insert({
        tenant_id: currentTenant.id,
        fournisseur_id: invoiceForm.fournisseur_id,
        purchase_order_id: invoiceForm.purchase_order_id,
        purchase_receipt_id: invoiceForm.purchase_receipt_id,
        kind: 'invoice',
        invoice_number: invoiceForm.invoice_number || null,
        invoice_date: invoiceForm.invoice_date,
        total_ttc: Number(invoiceForm.total_ttc || 0),
        document_path: documentPath,
        document_url: documentUrl,
        status: 'recorded',
      })
        .select('*, fournisseurs(nom)')
        .single()
      if (invoiceError) throw invoiceError

      setInvoiceFile(null)
      await fetchInvoices()
      if (insertedInvoice) {
        await reviewPurchaseInvoice({
          ...insertedInvoice,
          supplier_name: insertedInvoice.fournisseurs?.nom,
          total_ttc: Number(insertedInvoice.total_ttc || 0),
        } as PurchaseInvoice)
      }
    } catch (e: any) {
      setError(e.message)
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const openInvoiceDocument = async (invoice: PurchaseInvoice) => {
    if (!invoice.document_path && !invoice.document_url) return
    if (invoice.document_path) {
      const { data, error: signedError } = await supabase.storage
        .from('purchase-invoices')
        .createSignedUrl(invoice.document_path, 60 * 60)
      if (!signedError && data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
        return
      }
    }
    if (invoice.document_url) window.open(invoice.document_url, '_blank')
  }

  const saveCompanyProfile = async () => {
    if (!currentTenant) return
    setProfileSaving(true)
    setError('')

    const { error: profileError } = await supabase
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

    if (profileError) {
      setError(profileError.message)
      alert(profileError.message)
    } else {
      setIsCompanyProfileOpen(false)
    }
    setProfileSaving(false)
  }

  const resetInvoiceDraft = () => {
    setSelectedReviewInvoice(null)
    setInvoiceForm({
      fournisseur_id: '',
      purchase_order_id: '',
      purchase_receipt_id: '',
      invoice_number: '',
      invoice_date: today(),
      total_ttc: 0,
    })
    setInvoiceFile(null)
    setInvoiceItems([])
  }

  const reviewPurchaseInvoice = async (invoice: PurchaseInvoice) => {
    setSelectedReviewInvoice(invoice)
    setActiveTab('invoices')
    setInvoiceFile(null)
    setInvoiceForm({
      fournisseur_id: invoice.fournisseur_id,
      purchase_order_id: invoice.purchase_order_id || '',
      purchase_receipt_id: invoice.purchase_receipt_id || '',
      invoice_number: invoice.invoice_number || '',
      invoice_date: invoice.invoice_date || today(),
      total_ttc: Math.abs(Number(invoice.total_ttc || 0)),
    })

    if (invoice.purchase_order_id) {
      await loadInvoiceItems(invoice.purchase_order_id)
    } else {
      setInvoiceItems([])
    }
  }

  const printPurchaseInvoice = async (invoice: PurchaseInvoice) => {
    await reviewPurchaseInvoice(invoice)
    window.setTimeout(() => window.print(), 150)
  }

  const runConfirmedAction = async () => {
    if (!confirmState) return
    setConfirming(true)
    setError('')
    try {
      await confirmState.onConfirm()
      setConfirmState(null)
    } catch (e: any) {
      setError(e.message)
      alert(e.message)
    } finally {
      setConfirming(false)
    }
  }

  const confirmDeleteOrder = (order: PurchaseOrder) => {
    setConfirmState({
      title: 'Supprimer le BC',
      message: `Confirmer la suppression du BC #${order.id.slice(0, 8)} ?`,
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        const { error: deleteError } = await db.rpc('purchase_delete_order', { p_order_id: order.id })
        if (deleteError) throw deleteError
        if (selectedReceiptOrderId === order.id) setSelectedReceiptOrderId('')
        await Promise.all([fetchOrders(), fetchReceipts(), fetchInvoices()])
      },
    })
  }

  const confirmDeleteReceipt = (receipt: Receipt) => {
    setConfirmState({
      title: 'Supprimer le BR',
      message: `Confirmer la suppression du BR #${receipt.id.slice(0, 8)} ? Le stock sera inverse si le BR etait valide.`,
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        const { error: deleteError } = await db.rpc('purchase_delete_receipt', { p_receipt_id: receipt.id })
        if (deleteError) throw deleteError
        if (selectedReturnReceiptId === receipt.id) setSelectedReturnReceiptId('')
        await Promise.all([fetchOrders(), fetchReceipts(), fetchInvoices(), fetchArticleMetadata()])
      },
    })
  }

  const confirmDeleteInvoice = (invoice: PurchaseInvoice) => {
    setConfirmState({
      title: invoice.kind === 'credit_note' ? "Supprimer l'avoir" : 'Supprimer la facture',
      message: `Confirmer la suppression de ${invoice.invoice_number || '#' + invoice.id.slice(0, 8)} ?`,
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        const { error: deleteError } = await db.rpc('purchase_delete_invoice', { p_invoice_id: invoice.id })
        if (deleteError) throw deleteError
        if (selectedReviewInvoice?.id === invoice.id) resetInvoiceDraft()
        await Promise.all([fetchInvoices(), fetchReturns()])
      },
    })
  }

  const confirmDeleteReturn = (purchaseReturn: PurchaseReturn) => {
    setConfirmState({
      title: 'Supprimer le retour',
      message: `Confirmer la suppression du retour #${purchaseReturn.id.slice(0, 8)} ? Le stock sera inverse si le retour etait valide.`,
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        const { error: deleteError } = await db.rpc('purchase_delete_return', { p_return_id: purchaseReturn.id })
        if (deleteError) throw deleteError
        await Promise.all([fetchReturns(), fetchInvoices(), fetchArticleMetadata()])
      },
    })
  }

  const handleValidateReturn = async () => {
    if (!currentTenant) return
    const receipt = receipts.find((item) => item.id === selectedReturnReceiptId)
    setSaving(true)
    setError('')

    try {
      if (!receipt) throw new Error('Selectionnez un bon de reception.')
      const selectedLines = returnLines.filter((line) => Number(line.qty_to_return || 0) > 0)
      if (!selectedLines.length) throw new Error('Saisissez au moins une quantite a retourner.')
      for (const line of selectedLines) {
        if (line.qty_to_return > line.returnable_qty) {
          throw new Error(`${line.article_name}: la quantite retournee depasse la quantite disponible.`)
        }
      }

      const { data: createdReturn, error: returnError } = await db
        .from('purchase_returns')
        .insert({
          tenant_id: currentTenant.id,
          purchase_receipt_id: receipt.id,
          fournisseur_id: receipt.fournisseur_id,
          status: 'draft',
          returned_at: returnDate,
          reason: returnReason || null,
        })
        .select('id')
        .single()
      if (returnError) throw returnError

      const { error: itemError } = await db.from('purchase_return_items').insert(
        selectedLines.map((line) => ({
          tenant_id: currentTenant.id,
          purchase_return_id: createdReturn.id,
          purchase_receipt_item_id: line.id,
          article_id: line.article_id,
          qty_returned: Number(line.qty_to_return || 0),
          reason: line.reason || returnReason || null,
        }))
      )
      if (itemError) throw itemError

      let creditInvoiceId: string | null = null
      if (Number(creditAmountTtc || 0) > 0) {
        const { data: creditInvoice, error: invoiceError } = await db
          .from('purchase_invoices')
          .insert({
            tenant_id: currentTenant.id,
            fournisseur_id: receipt.fournisseur_id,
            purchase_order_id: receipt.purchase_order_id,
            purchase_receipt_id: receipt.id,
            purchase_return_id: createdReturn.id,
            kind: 'credit_note',
            invoice_number: creditNoteNumber || null,
            invoice_date: returnDate,
            total_ttc: -Math.abs(Number(creditAmountTtc || 0)),
            status: 'recorded',
          })
          .select('id')
          .single()
        if (invoiceError) throw invoiceError
        creditInvoiceId = creditInvoice.id
      }

      const { error: validateError } = await db
        .from('purchase_returns')
        .update({ status: 'validated', credit_invoice_id: creditInvoiceId })
        .eq('id', createdReturn.id)
        .eq('tenant_id', currentTenant.id)
      if (validateError) throw validateError

      setSelectedReturnReceiptId('')
      setReturnDate(today())
      setReturnReason('')
      setCreditNoteNumber('')
      setCreditAmountTtc(0)
      setReturnLines([])
      await Promise.all([fetchReturns(), fetchInvoices(), fetchArticleMetadata()])
    } catch (e: any) {
      setError(e.message)
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const orderTotal = useMemo(
    () => orderLines.reduce((acc, line) => acc + Number(line.qty || 0) * Number(line.unit_price || 0), 0),
    [orderLines]
  )

  const invoiceSubtotal = useMemo(
    () => invoiceItems.reduce((acc, item) => acc + item.qty_ordered * item.unit_price, 0),
    [invoiceItems]
  )
  const invoiceTotalTtc = Number(invoiceForm.total_ttc || 0)
  const invoiceTotalHt = priceMode === 'TTC' ? invoiceTotalTtc / 1.19 : invoiceSubtotal
  const invoiceTva = Math.max(0, invoiceTotalTtc - invoiceTotalHt)
  const selectedSupplier = suppliers.find((supplier) => supplier.id === invoiceForm.fournisseur_id)
  const selectedOrder = orders.find((order) => order.id === invoiceForm.purchase_order_id)
  const selectedReceipt = receipts.find((receipt) => receipt.id === invoiceForm.purchase_receipt_id)
  const openOrders = orders.filter((order) => !['recu', 'annule'].includes(order.status))
  const receiptOptions = invoiceForm.purchase_order_id
    ? receipts.filter((receipt) => receipt.purchase_order_id === invoiceForm.purchase_order_id && receipt.status === 'validated')
    : receipts.filter((receipt) => receipt.status === 'validated')

  const purchaseInvoiceColumns: InvoiceColumn[] = [
    { key: 'article', header: 'Article' },
    { key: 'ordered', header: 'Qte commandee', align: 'center' },
    { key: 'received', header: 'Qte recue', align: 'center' },
    { key: 'unit', header: 'Prix ' + priceMode, align: 'right' },
    { key: 'total', header: 'Total', align: 'right' },
  ]

  const purchaseInvoiceRows: InvoiceRow[] = invoiceItems.map((item) => ({
    id: item.id,
    cells: [
      <span className="font-semibold text-slate-900">{item.article_name}</span>,
      item.qty_ordered,
      item.qty_received,
      fmt(item.unit_price) + ' DT',
      <span className="font-bold text-slate-950">{fmt(item.qty_ordered * item.unit_price)} DT</span>,
    ],
  }))

  const purchaseInvoiceTotals: InvoiceTotalRow[] = [
    { label: 'Sous-total HT', value: fmt(invoiceTotalHt), emphasis: 'strong' },
    { label: 'TVA 19%', value: fmt(invoiceTva) },
    { label: 'Total TTC', value: fmt(invoiceTotalTtc), emphasis: 'grand' },
  ]

  const tabs = [
    { key: 'dashboard' as const, label: 'Tableau de bord', icon: BarChart3 },
    { key: 'orders' as const, label: 'Bon de Commande', icon: PackagePlus },
    { key: 'receipts' as const, label: 'Bon de Reception', icon: ClipboardCheck },
    { key: 'invoices' as const, label: 'Facture Fournisseur', icon: FileText },
    { key: 'returns' as const, label: 'Avoirs', icon: RotateCcw },
  ]

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <InvoicePrintStyles />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print-hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Achats</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cycle fournisseur: BC, BR, factures et avoirs</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button variant="secondary" onClick={() => setIsCompanyProfileOpen(true)} className="w-full sm:w-auto">
            <Building2 className="h-4 w-4" />
            Details de l'entreprise
          </Button>
          <Button variant="secondary" onClick={fetchAll} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print-hidden">
          {error}
        </div>
      )}
      <Modal isOpen={isCompanyProfileOpen} onClose={() => setIsCompanyProfileOpen(false)} title="Details de l'entreprise">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-800">Informations imprimees sur les factures</p>
            </div>
          </div>
          <Input
            label="Nom de l'entreprise"
            value={profile.company_name}
            onChange={(event) => setProfile((value) => ({ ...value, company_name: event.target.value }))}
          />
          <Input
            label="Adresse"
            value={profile.company_address}
            onChange={(event) => setProfile((value) => ({ ...value, company_address: event.target.value }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Telephone"
              value={profile.company_phone}
              onChange={(event) => setProfile((value) => ({ ...value, company_phone: event.target.value }))}
            />
            <Input
              label="Email"
              value={profile.company_email}
              onChange={(event) => setProfile((value) => ({ ...value, company_email: event.target.value }))}
            />
          </div>
          <Input
            label="Matricule fiscal / RC"
            value={profile.company_tax_id}
            onChange={(event) => setProfile((value) => ({ ...value, company_tax_id: event.target.value }))}
          />
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsCompanyProfileOpen(false)} className="w-full sm:w-auto">
              Annuler
            </Button>
            <Button type="button" onClick={saveCompanyProfile} disabled={profileSaving} className="w-full sm:w-auto">
              {profileSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="border-b border-slate-200 -mx-4 sm:mx-0 px-4 sm:px-0 print-hidden">
        <nav className="-mb-px flex space-x-6 overflow-x-auto hide-scrollbar" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium flex items-center gap-2 transition-all duration-200 shrink-0',
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard label="BC ouverts" value={openOrders.length.toString()} hint="En attente ou partiels" />
            <MetricCard label="BR valides" value={receipts.filter((r) => r.status === 'validated').length.toString()} hint="Livraisons tracees" />
            <MetricCard label="Factures" value={`${fmt(invoices.reduce((acc, inv) => acc + inv.total_ttc, 0))} DT`} hint="Inclut les avoirs" />
            <MetricCard label="Avoirs" value={returns.filter((item) => item.status === 'validated').length.toString()} hint="Retours fournisseur" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SimplePanel title="Derniers bons de commande">
              <CompactOrderTable orders={orders.slice(0, 6)} onDelete={confirmDeleteOrder} />
            </SimplePanel>
            <SimplePanel title="Dernieres factures">
              <CompactInvoiceTable invoices={invoices.slice(0, 6)} onOpenDocument={openInvoiceDocument} onReview={reviewPurchaseInvoice} onPrint={printPurchaseInvoice} onDelete={confirmDeleteInvoice} />
            </SimplePanel>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <SectionHeader icon={PackagePlus} title="Nouveau BC Fournisseur" subtitle='Statut initial: "En attente de reception"' />
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField label="Fournisseur" value={orderSupplierId} onChange={setOrderSupplierId} required>
                  <option value="">Selectionner un fournisseur</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.nom}</option>
                  ))}
                </SelectField>
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 self-end">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Total BC</p>
                  <p className="text-xl font-bold text-slate-900">{fmt(orderTotal)} DT</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-800">Articles commandes</h3>
                  <Button type="button" size="sm" onClick={() => setOrderLines((lines) => [...lines, emptyOrderLine()])}>
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </Button>
                </div>

                {orderLines.map((line, index) => {
                  const category = categories.find((item) => item.id === line.category_id)
                  const familyOptions = category ? families.filter((family) => family.id === category.famille_id) : []
                  const filteredArticles = articles.filter((article) =>
                    article.category_id === line.category_id && article.famille_id === line.famille_id
                  )
                  const lineTotal = Number(line.qty || 0) * Number(line.unit_price || 0)

                  return (
                    <div key={index} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Ligne {index + 1}</p>
                          <p className="mt-0.5 text-sm font-semibold text-slate-800">Article commande</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOrderLines((lines) => lines.filter((_, i) => i !== index))}
                          disabled={orderLines.length <= 1}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:text-slate-300 disabled:hover:bg-transparent"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
                        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                          <SelectField label="Categorie" value={line.category_id} onChange={(value) => handleCategoryChange(index, value)} required>
                            <option value="">Categorie</option>
                            {categories.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </SelectField>

                          <SelectField
                            label="Famille"
                            value={line.famille_id}
                            onChange={(value) => updateOrderLine(index, { famille_id: value, article_name: '' })}
                            disabled={!line.category_id}
                            required
                          >
                            <option value="">Famille</option>
                            {familyOptions.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </SelectField>

                          <div className="min-w-0 sm:col-span-2">
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">
                              Article<span className="ml-1 text-red-500">*</span>
                            </label>
                            <input
                              list={`purchase-articles-${index}`}
                              value={line.article_name}
                              onChange={(event) => updateOrderLine(index, { article_name: event.target.value })}
                              disabled={!line.famille_id}
                              className={selectClass}
                              placeholder="Selectionner ou taper un nouvel article"
                            />
                            <datalist id={`purchase-articles-${index}`}>
                              {filteredArticles.map((article) => (
                                <option key={article.id} value={article.nom} />
                              ))}
                            </datalist>
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 sm:hidden">
                              <p className="text-xs font-medium text-slate-400">Total</p>
                              <p className="mt-1 whitespace-nowrap text-right text-sm font-extrabold tabular-nums text-slate-900">{fmt(lineTotal)} DT</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(92px,0.65fr)_minmax(140px,1fr)_minmax(140px,0.9fr)]">
                          <Input
                            label="Qte"
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(event) => updateOrderLine(index, { qty: Number(event.target.value) })}
                            className="min-w-[92px] text-center font-semibold tabular-nums"
                          />

                          <Input
                            label="Prix unitaire"
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.unit_price}
                            onChange={(event) => updateOrderLine(index, { unit_price: Number(event.target.value) })}
                            className="min-w-[140px] text-right tabular-nums"
                          />

                          <div className="hidden min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 sm:col-span-1 sm:block">
                            <p className="text-xs font-medium text-slate-400">Total</p>
                            <p className="mt-1 min-w-0 whitespace-nowrap text-right text-sm font-extrabold tabular-nums text-slate-900 sm:text-base">{fmt(lineTotal)} DT</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea className={textareaClass} value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setOrderLines([emptyOrderLine()])} className="w-full sm:w-auto">
                  Reinitialiser
                </Button>
                <Button onClick={handleCreateOrder} disabled={saving} className="w-full sm:w-auto">
                  {saving ? 'Enregistrement...' : 'Enregistrer le BC'}
                </Button>
              </div>
            </div>
          </div>

          <SimplePanel title="Bons de commande">
            <CompactOrderTable orders={orders} onDelete={confirmDeleteOrder} />
          </SimplePanel>
        </div>
      )}

      {activeTab === 'receipts' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <SectionHeader icon={ClipboardCheck} title="Validation BR" subtitle="Lot + DLC/DLUO obligatoires pour chaque article recu" />
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField label="BC a receptionner" value={selectedReceiptOrderId} onChange={setSelectedReceiptOrderId} required>
                  <option value="">Selectionner un BC</option>
                  {orders.filter((order) => !['recu', 'annule'].includes(order.status)).map((order) => (
                    <option key={order.id} value={order.id}>
                      BC #{order.id.slice(0, 8)} - {order.supplier_name || 'Fournisseur'} - {statusBadgeLabel(order.status)}
                    </option>
                  ))}
                </SelectField>
                <Input label="Date de reception" type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} required />
              </div>

              <div className="space-y-3">
                {receiptLines.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Selectionnez un BC pour charger les articles.
                  </div>
                ) : (
                  receiptLines.map((line, index) => (
                    <div key={line.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-slate-50 rounded-xl border border-slate-100 p-4">
                      <div className="lg:col-span-3">
                        <p className="text-xs text-slate-400">Article</p>
                        <p className="text-sm font-semibold text-slate-800">{line.article_name}</p>
                        <p className="text-xs text-slate-500">Commande: {line.qty_ordered} | Deja recu: {line.qty_received}</p>
                      </div>
                      <div className="lg:col-span-2">
                        <Input
                          label="Qte recue"
                          type="number"
                          min={0}
                          max={line.remaining_qty}
                          value={line.qty_to_receive}
                          onChange={(event) => setReceiptLines((lines) => lines.map((item, i) => (
                            i === index ? { ...item, qty_to_receive: Number(event.target.value) } : item
                          )))}
                        />
                      </div>
                      <div className="lg:col-span-3">
                        <Input
                          label="Numero de lot"
                          value={line.lot_number}
                          onChange={(event) => setReceiptLines((lines) => lines.map((item, i) => (
                            i === index ? { ...item, lot_number: event.target.value } : item
                          )))}
                          required={line.qty_to_receive > 0}
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <Input
                          label="DLC/DLUO"
                          type="date"
                          value={line.expiry_date}
                          onChange={(event) => setReceiptLines((lines) => lines.map((item, i) => (
                            i === index ? { ...item, expiry_date: event.target.value } : item
                          )))}
                          required={line.qty_to_receive > 0}
                        />
                      </div>
                      <div className="lg:col-span-2 self-end text-right">
                        <p className="text-xs text-slate-400">Reste</p>
                        <p className="text-sm font-bold text-slate-800">{line.remaining_qty}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes de reception</label>
                <textarea className={textareaClass} value={receiptNotes} onChange={(event) => setReceiptNotes(event.target.value)} />
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button onClick={handleValidateReceipt} disabled={saving || !selectedReceiptOrderId} className="w-full sm:w-auto">
                  {saving ? 'Validation...' : 'Valider le BR'}
                </Button>
              </div>
            </div>
          </div>

          <SimplePanel title="Bons de reception">
            <CompactReceiptTable receipts={receipts} onDelete={confirmDeleteReceipt} />
          </SimplePanel>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print-hidden">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Facture d'Achat</h2>
              <p className="text-sm text-slate-500">Saisie, upload et rapprochement BC/BR/facture</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setPriceMode('TTC')}
                  className={clsx('flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-all', priceMode === 'TTC' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100')}
                >
                  TTC
                </button>
                <button
                  type="button"
                  onClick={() => setPriceMode('HT')}
                  className={clsx('flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-all', priceMode === 'HT' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100')}
                >
                  HT
                </button>
              </div>
              <Button onClick={() => window.print()} className="w-full sm:w-auto">
                <Printer className="h-4 w-4 mr-1.5" />
                Imprimer
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 h-fit print-hidden">
              <h2 className="text-sm font-semibold text-slate-800">Details de la facture fournisseur</h2>

              {selectedReviewInvoice && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                  Facture enregistree ouverte: {selectedReviewInvoice.invoice_number || '#' + selectedReviewInvoice.id.slice(0, 8)}
                </div>
              )}


              <SelectField
                label="Fournisseur"
                value={invoiceForm.fournisseur_id}
                onChange={(value) => setInvoiceForm((form) => ({ ...form, fournisseur_id: value }))}
                required
              >
                <option value="">Selectionner un fournisseur</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.nom}</option>
                ))}
              </SelectField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Numero facture"
                  value={invoiceForm.invoice_number}
                  onChange={(event) => setInvoiceForm((form) => ({ ...form, invoice_number: event.target.value }))}
                />
                <Input
                  label="Date de l'achat"
                  type="date"
                  value={invoiceForm.invoice_date}
                  onChange={(event) => setInvoiceForm((form) => ({ ...form, invoice_date: event.target.value }))}
                  required
                />
              </div>

              <Input
                label="Montant Total TTC"
                type="number"
                min={0}
                step="0.01"
                value={invoiceForm.total_ttc}
                onChange={(event) => setInvoiceForm((form) => ({ ...form, total_ttc: Number(event.target.value) }))}
                required
              />

              <SelectField
                label="BC lie"
                value={invoiceForm.purchase_order_id}
                onChange={(value) => {
                  const order = orders.find((item) => item.id === value)
                  setInvoiceForm((form) => ({
                    ...form,
                    purchase_order_id: value,
                    purchase_receipt_id: '',
                    fournisseur_id: order?.fournisseur_id || form.fournisseur_id,
                    total_ttc: order?.total_ttc || form.total_ttc,
                  }))
                }}
                required
              >
                <option value="">Selectionner le BC</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    BC #{order.id.slice(0, 8)} - {order.supplier_name || 'Fournisseur'}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="BR lie"
                value={invoiceForm.purchase_receipt_id}
                onChange={(value) => setInvoiceForm((form) => ({ ...form, purchase_receipt_id: value }))}
                required
              >
                <option value="">Selectionner le BR</option>
                {receiptOptions.map((receipt) => (
                  <option key={receipt.id} value={receipt.id}>
                    BR #{receipt.id.slice(0, 8)} - {new Date(receipt.received_at).toLocaleDateString('fr-FR')}
                  </option>
                ))}
              </SelectField>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Document original</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  <Upload className="h-4 w-4" />
                  {invoiceFile ? invoiceFile.name : 'Uploader PDF ou image'}
                  <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={handleInvoiceFileChange} />
                </label>
              </div>

              <div className="space-y-2">
                <Button onClick={handleSaveInvoice} disabled={saving || Boolean(selectedReviewInvoice)} className="w-full">
                  {selectedReviewInvoice ? 'Facture deja enregistree' : (saving ? 'Enregistrement...' : 'Enregistrer la facture')}
                </Button>
                {selectedReviewInvoice && (
                  <Button type="button" variant="secondary" onClick={resetInvoiceDraft} className="w-full">
                    Nouvelle facture
                  </Button>
                )}
              </div>
            </div>

            <div className="xl:col-span-2">
              <InvoiceTemplate
                title={selectedReviewInvoice?.kind === 'credit_note' ? 'Avoir fournisseur' : "Facture d'achat"}
                subtitle={selectedSupplier?.nom ? 'Fournisseur: ' + selectedSupplier.nom : 'Facture fournisseur'}
                documentNumber={invoiceForm.invoice_number || (selectedReviewInvoice ? '#' + selectedReviewInvoice.id.slice(0, 8) : '-')}
                issueDate={dateFmt(invoiceForm.invoice_date)}
                badge={selectedReviewInvoice?.kind === 'credit_note' ? 'Avoir' : (selectedReviewInvoice?.status || 'Brouillon')}
                logoUrl={currentTenant?.logo_url}
                company={{
                  label: 'Entreprise',
                  name: profile.company_name,
                  lines: [profile.company_address, profile.company_phone, profile.company_email],
                  taxId: profile.company_tax_id,
                }}
                counterparty={{
                  label: 'Fournisseur',
                  name: selectedSupplier?.nom,
                  lines: [selectedSupplier?.telephone, selectedSupplier?.email, selectedSupplier?.adresse],
                  taxId: selectedSupplier?.immatricule_fiscale,
                }}
                referenceTitle="Rapprochement"
                referenceItems={[
                  { label: 'BC', value: selectedOrder ? '#' + selectedOrder.id.slice(0, 8) + ' (' + formatInvoiceStatusLabel(selectedOrder.status) + ')' : '-' },
                  { label: 'BR', value: selectedReceipt ? '#' + selectedReceipt.id.slice(0, 8) + ' du ' + dateFmt(selectedReceipt.received_at) : '-' },
                  { label: 'Mode prix', value: priceMode },
                  { label: 'TVA', value: '19%' },
                ]}
                columns={purchaseInvoiceColumns}
                rows={purchaseInvoiceRows}
                emptyMessage="Selectionnez un BC pour afficher les lignes."
                totals={purchaseInvoiceTotals}
                accent={selectedReviewInvoice?.kind === 'credit_note' ? 'rose' : 'amber'}
              />
            </div>
          </div>

          <SimplePanel title="Factures enregistrees">
            <CompactInvoiceTable invoices={invoices} onOpenDocument={openInvoiceDocument} onReview={reviewPurchaseInvoice} onPrint={printPurchaseInvoice} onDelete={confirmDeleteInvoice} />
          </SimplePanel>
        </div>
      )}

      {activeTab === 'returns' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <SectionHeader icon={RotateCcw} title="Retour marchandises / Avoir" subtitle="Deduction automatique du stock a la validation" />
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField label="BR d'origine" value={selectedReturnReceiptId} onChange={setSelectedReturnReceiptId} required>
                  <option value="">Selectionner un BR</option>
                  {receipts.filter((receipt) => receipt.status === 'validated').map((receipt) => (
                    <option key={receipt.id} value={receipt.id}>
                      BR #{receipt.id.slice(0, 8)} - {receipt.supplier_name || 'Fournisseur'}
                    </option>
                  ))}
                </SelectField>
                <Input label="Date retour" type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
              </div>

              <div className="space-y-3">
                {returnLines.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Selectionnez un BR pour charger les lots recus.
                  </div>
                ) : (
                  returnLines.map((line, index) => (
                    <div key={line.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-slate-50 rounded-xl border border-slate-100 p-4">
                      <div className="lg:col-span-3">
                        <p className="text-xs text-slate-400">Article</p>
                        <p className="text-sm font-semibold text-slate-800">{line.article_name}</p>
                        <p className="text-xs text-slate-500">Lot {line.lot_number} | DLC {new Date(line.expiry_date).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <div className="lg:col-span-2">
                        <Input
                          label="Qte retour"
                          type="number"
                          min={0}
                          max={line.returnable_qty}
                          value={line.qty_to_return}
                          onChange={(event) => setReturnLines((lines) => lines.map((item, i) => (
                            i === index ? { ...item, qty_to_return: Number(event.target.value) } : item
                          )))}
                        />
                      </div>
                      <div className="lg:col-span-2 self-end">
                        <p className="text-xs text-slate-400">Disponible</p>
                        <p className="text-sm font-bold text-slate-800">{line.returnable_qty}</p>
                      </div>
                      <div className="lg:col-span-5">
                        <Input
                          label="Motif ligne"
                          value={line.reason}
                          onChange={(event) => setReturnLines((lines) => lines.map((item, i) => (
                            i === index ? { ...item, reason: event.target.value } : item
                          )))}
                          placeholder="Avarie, casse, non-conformite..."
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Motif general</label>
                <textarea className={textareaClass} value={returnReason} onChange={(event) => setReturnReason(event.target.value)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Input label="Numero avoir fournisseur" value={creditNoteNumber} onChange={(event) => setCreditNoteNumber(event.target.value)} />
                <Input
                  label="Montant avoir TTC"
                  type="number"
                  min={0}
                  step="0.01"
                  value={creditAmountTtc}
                  onChange={(event) => setCreditAmountTtc(Number(event.target.value))}
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button onClick={handleValidateReturn} disabled={saving || !selectedReturnReceiptId} className="w-full sm:w-auto">
                  {saving ? 'Validation...' : "Valider l'avoir / retour"}
                </Button>
              </div>
            </div>
          </div>

          <SimplePanel title="Avoirs et retours">
            <CompactReturnTable returns={returns} onDelete={confirmDeleteReturn} />
          </SimplePanel>
        </div>
      )}

      <Modal
        isOpen={Boolean(confirmState)}
        onClose={() => {
          if (!confirming) setConfirmState(null)
        }}
        title={confirmState?.title || 'Confirmation'}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            <Trash2 className="h-5 w-5 flex-shrink-0 text-red-500" />
            <p>{confirmState?.message}</p>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setConfirmState(null)} disabled={confirming} className="w-full sm:w-auto">
              Annuler
            </Button>
            <Button type="button" onClick={runConfirmedAction} disabled={confirming} className="w-full sm:w-auto !bg-red-600 hover:!bg-red-700 !shadow-none">
              {confirming ? 'Suppression...' : (confirmState?.confirmLabel || 'OK')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof PackagePlus; title: string; subtitle: string }) {
  return (
    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-100 text-blue-600">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  children,
  disabled,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
  disabled?: boolean
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass} disabled={disabled}>
        {children}
      </select>
    </div>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  )
}

function SimplePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Boxes className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function CompactOrderTable({ orders, onDelete }: { orders: PurchaseOrder[]; onDelete?: (order: PurchaseOrder) => void }) {
  if (!orders.length) return <p className="text-sm text-slate-400 text-center py-8">Aucun BC.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="text-left py-2">BC</th>
            <th className="text-left py-2">Fournisseur</th>
            <th className="text-left py-2">Statut</th>
            <th className="text-right py-2">Total</th>
            {onDelete && <th className="text-right py-2">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="py-2 font-mono text-xs text-slate-500">#{order.id.slice(0, 8)}</td>
              <td className="py-2 text-slate-700">{order.supplier_name || '-'}</td>
              <td className="py-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(order.status)}`}>
                  {statusBadgeLabel(order.status)}
                </span>
              </td>
              <td className="py-2 text-right font-semibold">{fmt(order.total_ttc)} DT</td>
              {onDelete && (
                <td className="py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => onDelete(order)} title="Supprimer le BC">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompactReceiptTable({ receipts, onDelete }: { receipts: Receipt[]; onDelete?: (receipt: Receipt) => void }) {
  if (!receipts.length) return <p className="text-sm text-slate-400 text-center py-8">Aucun BR.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="text-left py-2">BR</th>
            <th className="text-left py-2">Fournisseur</th>
            <th className="text-left py-2">Date</th>
            <th className="text-left py-2">Statut</th>
            {onDelete && <th className="text-right py-2">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {receipts.map((receipt) => (
            <tr key={receipt.id}>
              <td className="py-2 font-mono text-xs text-slate-500">#{receipt.id.slice(0, 8)}</td>
              <td className="py-2 text-slate-700">{receipt.supplier_name || '-'}</td>
              <td className="py-2 text-slate-600">{new Date(receipt.received_at).toLocaleDateString('fr-FR')}</td>
              <td className="py-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(receipt.status)}`}>
                  {statusBadgeLabel(receipt.status)}
                </span>
              </td>
              {onDelete && (
                <td className="py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => onDelete(receipt)} title="Supprimer le BR">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompactInvoiceTable({
  invoices,
  onOpenDocument,
  onReview,
  onPrint,
  onDelete,
}: {
  invoices: PurchaseInvoice[]
  onOpenDocument: (invoice: PurchaseInvoice) => void
  onReview?: (invoice: PurchaseInvoice) => void | Promise<void>
  onPrint?: (invoice: PurchaseInvoice) => void | Promise<void>
  onDelete?: (invoice: PurchaseInvoice) => void
}) {
  if (!invoices.length) return <p className="text-sm text-slate-400 text-center py-8">Aucune facture.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="text-left py-2">Facture</th>
            <th className="text-left py-2">Fournisseur</th>
            <th className="text-left py-2">Type</th>
            <th className="text-right py-2">Total TTC</th>
            <th className="text-right py-2">Doc</th>
            {(onReview || onPrint || onDelete) && <th className="text-right py-2">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td className="py-2">
                <span className="font-medium text-slate-800">{invoice.invoice_number || `#${invoice.id.slice(0, 8)}`}</span>
                <p className="text-xs text-slate-400">{new Date(invoice.invoice_date).toLocaleDateString('fr-FR')}</p>
              </td>
              <td className="py-2 text-slate-700">{invoice.supplier_name || '-'}</td>
              <td className="py-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${invoice.kind === 'credit_note' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                  {invoice.kind === 'credit_note' ? 'Avoir' : 'Facture'}
                </span>
              </td>
              <td className={clsx('py-2 text-right font-semibold', invoice.total_ttc < 0 ? 'text-red-600' : 'text-slate-900')}>
                {fmt(invoice.total_ttc)} DT
              </td>
              <td className="py-2 text-right">
                {(invoice.document_path || invoice.document_url) ? (
                  <Button size="sm" variant="ghost" onClick={() => onOpenDocument(invoice)} title="Ouvrir le document">
                    <FileText className="h-4 w-4" />
                  </Button>
                ) : (
                  <span className="text-xs text-slate-300">-</span>
                )}
              </td>
              {(onReview || onPrint || onDelete) && (
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    {onReview && (
                      <Button size="sm" variant="ghost" onClick={() => onReview(invoice)} title="Revoir la facture">
                        <Eye className="h-4 w-4 text-slate-600" />
                      </Button>
                    )}
                    {onPrint && (
                      <Button size="sm" variant="ghost" onClick={() => onPrint(invoice)} title="Reimprimer la facture">
                        <Printer className="h-4 w-4 text-slate-600" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button size="sm" variant="ghost" onClick={() => onDelete(invoice)} title="Supprimer la facture">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompactReturnTable({ returns, onDelete }: { returns: PurchaseReturn[]; onDelete?: (purchaseReturn: PurchaseReturn) => void }) {
  if (!returns.length) return <p className="text-sm text-slate-400 text-center py-8">Aucun avoir.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="text-left py-2">Retour</th>
            <th className="text-left py-2">Fournisseur</th>
            <th className="text-left py-2">Date</th>
            <th className="text-left py-2">Statut</th>
            {onDelete && <th className="text-right py-2">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {returns.map((item) => (
            <tr key={item.id}>
              <td className="py-2 font-mono text-xs text-slate-500">#{item.id.slice(0, 8)}</td>
              <td className="py-2 text-slate-700">{item.supplier_name || '-'}</td>
              <td className="py-2 text-slate-600">{new Date(item.returned_at).toLocaleDateString('fr-FR')}</td>
              <td className="py-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(item.status)}`}>
                  {statusBadgeLabel(item.status)}
                </span>
              </td>
              {onDelete && (
                <td className="py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => onDelete(item)} title="Supprimer le retour">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
