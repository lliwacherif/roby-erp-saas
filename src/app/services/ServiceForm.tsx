import { useEffect, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'
import { ClientSelect } from './ClientSelect'
import { Trash, Plus, ShoppingBag, CalendarDays, Package, ArrowLeft, Receipt, Gift } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const itemSchema = z.object({
    article_id: z.coerce.string().min(1, "Article is required"),
    qty: z.coerce.number().min(1, "Qty must be >= 1"),
    unit_price: z.coerce.number().min(0, "Price must be >= 0"),
    is_gift: z.coerce.boolean().optional(),
    rental_deposit: z.coerce.number().min(0).optional(),
    rental_start: z.string().optional(),
    rental_end: z.string().optional(),
})

const schema = z.object({
    type: z.enum(['vente', 'location']),
    client_id: z.coerce.string().min(1, "Client is required"),
    discount_amount: z.coerce.number().min(0).optional(),
    items: z.array(itemSchema).min(1, "At least one item is required")
})

type FormData = z.infer<typeof schema>

export default function ServiceForm() {
    const navigate = useNavigate()
    const { t } = useI18n()
    const isEditing = false
    const { register, control, handleSubmit, watch, setValue, getValues, formState: { errors, isSubmitting } } = useForm<FormData>({
        resolver: zodResolver(schema) as any,
        defaultValues: {
            type: 'vente',
            client_id: '',
            discount_amount: 0,
            items: [{ article_id: '', qty: 1, unit_price: 0, is_gift: false, rental_deposit: 0, rental_start: '', rental_end: '' }]
        }
    })

    const { fields, append, remove } = useFieldArray({ control, name: "items" })
    const { currentTenant } = useTenant()
    const [articles, setArticles] = useState<{
        id: string
        nom: string
        prix_achat: number
        prix_location_min: number
        prix_location_max: number
        qte_on_hand: number
    }[]>([])
    const [loading, setLoading] = useState(false)

    const type = watch('type')
    const watchedItems = watch('items')
    const selectedLocationProducts = watchedItems?.filter((item) => Boolean(item?.article_id)).length || 0
    const canUseGift = type === 'location' && selectedLocationProducts >= 2
    const subtotal = watchedItems?.reduce((acc, item) => acc + (item.qty || 0) * (item.unit_price || 0), 0) || 0
    const discountAmount = Number(watch('discount_amount') || 0)
    const total = Math.max(0, subtotal - discountAmount)
    const totalDeposit = watchedItems?.reduce((acc, item) => acc + (Number(item.rental_deposit) || 0), 0) || 0

    useEffect(() => {
        if (type !== 'location' || canUseGift) return
        watchedItems?.forEach((item, index) => {
            if (item?.is_gift) {
                setValue(`items.${index}.is_gift`, false)
                const article = articles.find(a => a.id === item.article_id)
                if (article) setValue(`items.${index}.unit_price`, article.prix_location_min)
            }
        })
    }, [type, canUseGift, watchedItems, setValue, articles])

    useEffect(() => {
        if (currentTenant) fetchArticles()
    }, [currentTenant])

    const fetchArticles = async () => {
        if (!currentTenant) return
        const { data } = await supabase
            .from('articles')
            .select('id, nom, prix_achat, prix_location_min, prix_location_max, qte_on_hand')
            .eq('tenant_id', currentTenant.id)
            .order('nom')
        if (data) setArticles(data as any[])
    }

    const handleArticleChange = (index: number, articleId: string) => {
        setValue(`items.${index}.article_id`, articleId)
        const article = articles.find(a => a.id === articleId)
        if (article) {
            const defaultPrice = type === 'location' ? article.prix_location_min : article.prix_achat
            const isGift = Boolean(getValues(`items.${index}.is_gift`))
            setValue(`items.${index}.unit_price`, isGift ? 0 : defaultPrice)
        }
    }

    const toggleGift = (index: number) => {
        if (!canUseGift) return
        const current = Boolean(getValues(`items.${index}.is_gift`))
        const next = !current
        setValue(`items.${index}.is_gift`, next)
        if (next) {
            setValue(`items.${index}.unit_price`, 0)
        } else {
            const articleId = getValues(`items.${index}.article_id`)
            const article = articles.find(a => a.id === articleId)
            if (article) {
                const defaultPrice = type === 'location' ? article.prix_location_min : article.prix_achat
                setValue(`items.${index}.unit_price`, defaultPrice)
            }
        }
    }

    const onSubmit = async (data: FormData) => {
        if (!currentTenant) return
        setLoading(true)

        try {
            const { data: liveStock } = await supabase.from('v_stock_overview').select('id, nom, qte_on_hand').eq('tenant_id', currentTenant.id)
            const stockMap = new Map((liveStock || []).map((s: any) => [s.id, s]))
            const locationProductCount = data.items.filter((item) => Boolean(item.article_id)).length

            for (const item of data.items) {
                const stock = stockMap.get(item.article_id) as any
                const article = articles.find(a => a.id === item.article_id)
                const available = stock?.qte_on_hand ?? article?.qte_on_hand ?? 0
                if (!article) throw new Error('Article not found')
                if (available < item.qty) {
                    throw new Error(`Insufficient stock for ${article.nom}. Available: ${available}, Requested: ${item.qty}`)
                }

                if (data.type === 'location') {
                    if (Boolean(item.is_gift) && locationProductCount < 2) {
                        throw new Error('Mode cadeau disponible a partir de 2 produits location.')
                    }
                    const min = Number(article.prix_location_min ?? 0)
                    const max = Number(article.prix_location_max ?? 0)
                    const isGift = Boolean(item.is_gift)
                    if (!isGift && (item.unit_price < min || item.unit_price > max)) {
                        throw new Error(`${article.nom}: ${t('locationPriceRangeError')} [${min} - ${max}]`)
                    }
                    if (isGift && item.unit_price !== 0) {
                        throw new Error(`${article.nom}: cadeau doit etre a 0 DT.`)
                    }
                    if (!item.rental_start || !item.rental_end) {
                        throw new Error(`${article.nom}: ${t('rentalPeriod')} (${t('from')} / ${t('to')}) is required.`)
                    }
                    if (item.rental_end < item.rental_start) {
                        throw new Error(`${article.nom}: ${t('to')} must be after ${t('from')}.`)
                    }
                }
            }

            const computedSubtotal = data.items.reduce((acc, item) => acc + (item.qty || 0) * (item.unit_price || 0), 0)
            const computedDiscount = Number(data.discount_amount || 0)
            if (computedDiscount > computedSubtotal) {
                throw new Error(`Remise ne peut pas depasser le total (${computedSubtotal.toLocaleString('fr-FR')} DT).`)
            }
            const computedTotal = Math.max(0, computedSubtotal - computedDiscount)
            const computedDeposit = data.type === 'location'
                ? data.items.reduce((acc, item) => acc + (Number(item.rental_deposit) || 0), 0)
                : 0
            const locationStarts = data.type === 'location'
                ? data.items.map(i => i.rental_start).filter(Boolean) as string[]
                : []
            const locationEnds = data.type === 'location'
                ? data.items.map(i => i.rental_end).filter(Boolean) as string[]
                : []
            const serviceRentalStart = locationStarts.length ? locationStarts.sort()[0] : null
            const serviceRentalEnd = locationEnds.length ? locationEnds.sort().slice(-1)[0] : null

            const { data: service, error: serviceError } = await supabase.from('services').insert({
                tenant_id: currentTenant.id,
                client_id: data.client_id,
                type: data.type,
                status: 'confirmed',
                rental_start: serviceRentalStart,
                rental_end: serviceRentalEnd,
                rental_deposit: computedDeposit,
                discount_amount: computedDiscount,
                total: computedTotal
            }).select().single()

            if (serviceError) throw serviceError
            const svc = service as any
            if (!svc) throw new Error('Failed to create service')

            const itemsToInsert = data.items.map(item => ({
                tenant_id: currentTenant.id,
                service_id: svc.id,
                article_id: item.article_id,
                qty: item.qty,
                unit_price: item.unit_price,
                rental_deposit: data.type === 'location' ? (Number(item.rental_deposit) || 0) : null,
                rental_start: data.type === 'location' ? (item.rental_start || null) : null,
                rental_end: data.type === 'location' ? (item.rental_end || null) : null,
            }))
            const { error: itemsError } = await supabase.from('service_items').insert(itemsToInsert)
            if (itemsError) throw itemsError

            if (data.type === 'vente') {
                const movementsToInsert = data.items.map(item => ({
                    tenant_id: currentTenant.id,
                    article_id: item.article_id,
                    qty_delta: -item.qty,
                    reason: `Sale #${svc.id.slice(0, 8)}`,
                    ref_table: 'services',
                    ref_id: svc.id
                }))
                const { error: moveError } = await supabase.from('stock_movements').insert(movementsToInsert)
                if (moveError) throw moveError
            }

            navigate('/app/services')
        } catch (e: any) {
            alert(e.message)
        } finally {
            setLoading(false)
        }
    }

    const onInvalid = () => {
        const firstItemErr = errors.items?.find?.((e: any) => e && (
            e.article_id?.message ||
            e.qty?.message ||
            e.unit_price?.message ||
            e.rental_start?.message ||
            e.rental_end?.message ||
            e.rental_deposit?.message
        ))
        const message =
            errors.client_id?.message ||
            (typeof errors.items?.message === 'string' ? errors.items.message : undefined) ||
            firstItemErr?.article_id?.message ||
            firstItemErr?.qty?.message ||
            firstItemErr?.unit_price?.message ||
            firstItemErr?.rental_start?.message ||
            firstItemErr?.rental_end?.message ||
            firstItemErr?.rental_deposit?.message ||
            'Veuillez verifier les champs obligatoires.'
        alert(String(message))
    }

    return (
        <div className="max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/app/services')}
                    className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{isEditing ? t('editService') : t('newService')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{t('serviceDetails')}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">

                {/* ─── Section 1: Service Type & Client ─── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-100 text-blue-600">
                                <ShoppingBag className="h-4 w-4" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-slate-800">{t('serviceDetails')}</h2>
                                <p className="text-xs text-slate-400">Type & Client</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Type Toggle */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <label
                                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium ${type === 'vente'
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        <input type="radio" value="vente" {...register('type')} className="sr-only" />
                                        <ShoppingBag className="h-4 w-4" />
                                        Vente
                                    </label>
                                    <label
                                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium ${type === 'location'
                                            ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        <input type="radio" value="location" {...register('type')} className="sr-only" />
                                        <CalendarDays className="h-4 w-4" />
                                        Location
                                    </label>
                                </div>
                            </div>

                            {/* Client */}
                            <Controller
                                control={control}
                                name="client_id"
                                render={({ field }) => (
                                    <ClientSelect
                                        value={field.value}
                                        onChange={field.onChange}
                                        label={t('client')}
                                        error={errors.client_id?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>
                </div>

                {/* ─── Section 2: Rental Details (only for location) ─── */}
                {type === 'location' && (
                    <div className="bg-white rounded-2xl border border-violet-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-violet-50 to-white border-b border-violet-100">
                            <div className="flex items-center gap-2.5">
                                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-violet-100 text-violet-600">
                                    <CalendarDays className="h-4 w-4" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-800">{t('rentalPeriod')}</h2>
                                    <p className="text-xs text-slate-400">{t('from')} / {t('to')}</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 text-sm text-slate-500 self-center">
                                    Periode de location definie par article dans chaque ligne ci-dessous.
                                </div>
                                <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2 text-sm text-violet-700">
                                    {t('deposit')}: {totalDeposit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DT
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Section 3: Items ─── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600">
                                    <Package className="h-4 w-4" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-800">{t('serviceItems')}</h2>
                                    <p className="text-xs text-slate-400">{fields.length} article{fields.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => append({ article_id: '', qty: 1, unit_price: 0, is_gift: false, rental_deposit: 0, rental_start: '', rental_end: '' })}
                            >
                                <Plus className="h-4 w-4" />
                                {t('add')}
                            </Button>
                        </div>
                    </div>
                    <div className="p-6 space-y-3">
                        {/* Table Header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-4 mb-1">
                            <div className="col-span-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Article</div>
                            <div className="col-span-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('qty')}</div>
                            <div className="col-span-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('unitPrice')}</div>
                            <div className="col-span-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Subtotal</div>
                            <div className="col-span-1"></div>
                        </div>

                        {fields.map((field, index) => {
                            const qty = watchedItems?.[index]?.qty || 0
                            const price = watchedItems?.[index]?.unit_price || 0
                            const isGift = Boolean(watchedItems?.[index]?.is_gift)
                            const subtotal = qty * price

                            return (
                                <div
                                    key={field.id}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 hover:border-slate-200 transition-all"
                                >
                                    {/* Article Select */}
                                    <div className="md:col-span-5">
                                        <select
                                            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                                            {...register(`items.${index}.article_id`)}
                                            onChange={(e) => handleArticleChange(index, e.target.value)}
                                        >
                                            <option value="">{t('selectArticle')}</option>
                                            {articles.map(a => (
                                                <option key={a.id} value={a.id}>
                                                    {a.nom}  •  {a.qte_on_hand} {t('inStock')}
                                                    {type === 'location' ? `  •  ${a.prix_location_min}-${a.prix_location_max} DT` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.items?.[index]?.article_id && (
                                            <p className="text-xs text-red-500 mt-1">{errors.items[index]?.article_id?.message}</p>
                                        )}
                                    </div>

                                    {/* Qty */}
                                    <div className="md:col-span-2">
                                        <Input
                                            type="number"
                                            min={1}
                                            {...register(`items.${index}.qty`)}
                                            className="text-center"
                                        />
                                    </div>

                                    {/* Unit Price */}
                                    <div className="md:col-span-2">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            {...register(`items.${index}.unit_price`)}
                                            disabled={type === 'location' && isGift}
                                        />
                                    </div>

                                    {/* Subtotal */}
                                    <div className="md:col-span-2 text-right">
                                        <span className="text-sm font-bold text-slate-800">{subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DT</span>
                                    </div>

                                    {/* Remove */}
                                    <div className="md:col-span-1 flex justify-end gap-1.5">
                                        {type === 'location' && (
                                            <button
                                                type="button"
                                                onClick={() => toggleGift(index)}
                                                disabled={!canUseGift}
                                                title={canUseGift ? 'Marquer cadeau (0 DT)' : 'Disponible a partir de 2 produits location'}
                                                className={`p-2 rounded-lg transition-all ${
                                                    isGift
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : canUseGift
                                                            ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                                            : 'text-slate-300 cursor-not-allowed'
                                                }`}
                                            >
                                                <Gift className="h-4 w-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
                                            disabled={fields.length <= 1}
                                            className={`p-2 rounded-lg transition-all ${fields.length <= 1
                                                ? 'text-slate-300 cursor-not-allowed'
                                                : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                                }`}
                                        >
                                            <Trash className="h-4 w-4" />
                                        </button>
                                    </div>

                                    {type === 'location' && (
                                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200/70">
                                            <Input
                                                type="date"
                                                label={`${t('from')} (Article)`}
                                                {...register(`items.${index}.rental_start`)}
                                            />
                                            <Input
                                                type="date"
                                                label={`${t('to')} (Article)`}
                                                {...register(`items.${index}.rental_end`)}
                                            />
                                            <Input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                label={`${t('deposit')} (Article)`}
                                                {...register(`items.${index}.rental_deposit`)}
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {errors.items && typeof errors.items.message === 'string' && (
                            <p className="text-red-600 text-sm px-4">{errors.items.message}</p>
                        )}
                    </div>
                </div>

                {/* ─── Section 4: Discount (location) ─── */}
                {type === 'location' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                            <h2 className="text-sm font-semibold text-slate-800">Remise</h2>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    label="Montant Remise (DT)"
                                    {...register('discount_amount')}
                                />
                                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 self-end">
                                    Sous-total: {subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DT
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Section 5: Total & Actions ─── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-100 text-amber-600">
                                <Receipt className="h-4 w-4" />
                            </div>
                            <h2 className="text-sm font-semibold text-slate-800">{t('total')}</h2>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-6">
                                    <div>
                                        <p className="text-xs text-slate-400 uppercase tracking-wider">{t('serviceItems')}</p>
                                        <p className="text-2xl font-bold text-slate-900">{total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-base font-medium text-slate-400">DT</span></p>
                                    </div>
                                    {type === 'location' && discountAmount > 0 && (
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase tracking-wider">Remise</p>
                                            <p className="text-lg font-semibold text-red-500">- {discountAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-sm font-medium text-red-300">DT</span></p>
                                        </div>
                                    )}
                                    {type === 'location' && totalDeposit > 0 && (
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase tracking-wider">{t('deposit')}</p>
                                            <p className="text-lg font-semibold text-violet-600">{Number(totalDeposit).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-sm font-medium text-violet-400">DT</span></p>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400">{fields.length} article{fields.length !== 1 ? 's' : ''} • {type === 'vente' ? 'Vente' : 'Location'}</p>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => navigate('/app/services')}
                                    className="px-6"
                                >
                                    {t('cancel')}
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || loading}
                                    className="px-8 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-600/25"
                                >
                                    {isSubmitting || loading ? t('saving') : t('save')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    )
}
