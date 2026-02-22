import { useEffect, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'

const schema = z.object({
    nom: z.string().min(1, 'Name is required'),
    famille_id: z.string().min(1, 'Famille is required'),
    category_id: z.string().min(1, 'Category is required'),
    couleur: z.string().optional(),
    prix_achat: z.coerce.number().min(0, 'Price must be positive'),
    prix_vente_detail: z.coerce.number().min(0, 'Retail price must be positive'),
    prix_vente_gros: z.coerce.number().min(0, 'Wholesale price must be positive'),
    prix_location_min: z.coerce.number().optional(),
    prix_location_max: z.coerce.number().optional(),
    qte_on_hand: z.coerce.number().min(0, 'Quantity must be >= 0'),
}).refine((data) => {
    const min = data.prix_location_min || 0;
    const max = data.prix_location_max || 0;
    if (max > 0 && max < min) return false;
    return true;
}, {
    path: ['prix_location_max'],
    message: 'Location max must be >= location min',
})

type FormData = z.infer<typeof schema>

interface ArticleFormProps {
    onSuccess: () => void
    onCancel: () => void
    initialData?: {
        id: string
        nom: string
        famille_id: string
        category_id: string
        couleur: string | null
        prix_achat: number
        prix_vente_detail: number
        prix_vente_gros: number
        prix_location_min: number | null
        prix_location_max: number | null
        qte_on_hand: number
        photo_url: string | null
    }
}

export function ArticleForm({ onSuccess, onCancel, initialData }: ArticleFormProps) {
    const { t } = useI18n()

    const schema = z.object({
        nom: z.string().min(1, t('articleName') + ' is required'),
        famille_id: z.string().min(1, t('famille') + ' is required'),
        category_id: z.string().min(1, t('category') + ' is required'),
        couleur: z.string().optional(),
        prix_achat: z.coerce.number().min(0, t('purchasePrice') + ' must be positive'),
        prix_vente_detail: z.coerce.number().min(0, t('retailPrice') + ' must be positive'),
        prix_vente_gros: z.coerce.number().min(0, t('wholesalePrice') + ' must be positive'),
        prix_location_min: z.coerce.number().optional(),
        prix_location_max: z.coerce.number().optional(),
        qte_on_hand: z.coerce.number().min(0, t('initialQty') + ' must be >= 0'),
    }).refine((data) => {
        const min = data.prix_location_min || 0;
        const max = data.prix_location_max || 0;
        if (max > 0 && max < min) return false;
        return true;
    }, {
        path: ['prix_location_max'],
        message: t('locationPriceRangeError'),
    })

    const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema) as any,
        defaultValues: { qte_on_hand: 0, prix_location_min: 0, prix_location_max: 0, prix_vente_detail: 0, prix_vente_gros: 0 }
    })
    const { currentTenant } = useTenant()
    const [familles, setFamilles] = useState<{ id: string, name: string }[]>([])
    const [categories, setCategories] = useState<{ id: string, name: string, famille_id: string }[]>([])
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [photoError, setPhotoError] = useState('')
    const [saving, setSaving] = useState(false)

    const selectedFamilleId = watch('famille_id')
    const isEditMode = !!initialData

    useEffect(() => {
        if (currentTenant) fetchData()
    }, [currentTenant])

    useEffect(() => {
        if (!initialData) return
        reset({
            nom: initialData.nom,
            famille_id: initialData.famille_id,
            category_id: initialData.category_id,
            couleur: initialData.couleur || '',
            prix_achat: initialData.prix_achat,
            prix_vente_detail: initialData.prix_vente_detail,
            prix_vente_gros: initialData.prix_vente_gros,
            prix_location_min: initialData.prix_location_min || 0,
            prix_location_max: initialData.prix_location_max || 0,
            qte_on_hand: initialData.qte_on_hand,
        })
        setPhotoPreview(initialData.photo_url || null)
    }, [initialData, reset])

    const fetchData = async () => {
        if (!currentTenant) return
        const { data: fData } = await supabase.from('famille_articles').select('id, name').eq('tenant_id', currentTenant.id)
        if (fData) setFamilles(fData)

        const { data: cData } = await supabase.from('article_categories').select('id, name, famille_id').eq('tenant_id', currentTenant.id)
        if (cData) setCategories(cData)
    }

    const filteredCategories = categories.filter(c => c.famille_id === selectedFamilleId)

    const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null
        setPhotoError('')

        if (!file) {
            setPhotoFile(null)
            setPhotoPreview(null)
            return
        }

        if (!file.type.startsWith('image/')) {
            setPhotoError('Please choose a valid image file.')
            return
        }

        if (file.size > 2 * 1024 * 1024) {
            setPhotoError('Photo too large (max 2MB).')
            return
        }

        setPhotoFile(file)
        setPhotoPreview(URL.createObjectURL(file))
    }

    const onSubmit = async (data: FormData) => {
        if (!currentTenant) return
        setSaving(true)

        let targetArticleId = initialData?.id
        let dbError: any = null

        if (isEditMode && targetArticleId) {
            const { error } = await supabase
                .from('articles')
                .update({
                    category_id: data.category_id,
                    famille_id: data.famille_id,
                    nom: data.nom,
                    couleur: data.couleur || null,
                    prix_achat: data.prix_achat,
                    prix_vente_detail: data.prix_vente_detail,
                    prix_vente_gros: data.prix_vente_gros,
                    prix_location_min: data.prix_location_min || 0,
                    prix_location_max: data.prix_location_max || 0,
                    qte_on_hand: data.qte_on_hand,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', targetArticleId)
                .eq('tenant_id', currentTenant.id)
            dbError = error
        } else {
            const { data: insertedArticle, error } = await supabase.from('articles').insert({
                tenant_id: currentTenant.id,
                category_id: data.category_id,
                famille_id: data.famille_id,
                nom: data.nom,
                couleur: data.couleur || null,
                prix_achat: data.prix_achat,
                prix_vente_detail: data.prix_vente_detail,
                prix_vente_gros: data.prix_vente_gros,
                prix_location_min: data.prix_location_min || 0,
                prix_location_max: data.prix_location_max || 0,
                qte_on_hand: data.qte_on_hand
            }).select('id').single()
            dbError = error
            targetArticleId = insertedArticle?.id
        }

        if (dbError) {
            alert(dbError.message)
            setSaving(false)
        } else {
            if (photoFile && targetArticleId) {
                const ext = photoFile.name.includes('.') ? photoFile.name.split('.').pop() : 'png'
                const path = `${currentTenant.id}/${targetArticleId}.${ext}`
                const { error: uploadError } = await supabase.storage
                    .from('article-photos')
                    .upload(path, photoFile, { upsert: true, contentType: photoFile.type })

                if (uploadError && /bucket not found/i.test(uploadError.message)) {
                    throw new Error('Bucket "article-photos" missing. Run sql/article_photo_support.sql once in Supabase SQL editor.')
                }

                if (uploadError) {
                    alert(uploadError.message)
                    setSaving(false)
                    return
                }

                const { data: publicUrlData } = supabase.storage.from('article-photos').getPublicUrl(path)
                const { error: updatePhotoError } = await supabase
                    .from('articles')
                    .update({ photo_url: publicUrlData.publicUrl })
                    .eq('id', targetArticleId)
                    .eq('tenant_id', currentTenant.id)

                if (updatePhotoError) {
                    alert(updatePhotoError.message)
                    setSaving(false)
                    return
                }
            }
            setSaving(false)
            onSuccess()
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label={t('articleName')} {...register('nom')} error={errors.nom?.message} required />

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('famille')}
                    <span className="text-red-500 ml-1">*</span>
                </label>
                <select {...register('famille_id')} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                    <option value="">{t('selectFamille')}</option>
                    {familles.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                </select>
                {errors.famille_id && <p className="text-red-600 text-sm mt-1">{errors.famille_id.message}</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('category')}
                    <span className="text-red-500 ml-1">*</span>
                </label>
                <select {...register('category_id')} disabled={!selectedFamilleId} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100">
                    <option value="">{t('selectCategory')}</option>
                    {filteredCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                {errors.category_id && <p className="text-red-600 text-sm mt-1">{errors.category_id.message}</p>}
            </div>

            <Input label={t('color')} {...register('couleur')} />
            <Input label={t('initialQty')} type="number" {...register('qte_on_hand')} error={errors.qte_on_hand?.message} required />
            <Input label={t('purchasePrice')} type="number" step="0.01" {...register('prix_achat')} error={errors.prix_achat?.message} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label={t('retailPrice')} type="number" step="0.01" {...register('prix_vente_detail')} error={errors.prix_vente_detail?.message} required />
                <Input label={t('wholesalePrice')} type="number" step="0.01" {...register('prix_vente_gros')} error={errors.prix_vente_gros?.message} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label={t('locationPriceMin')} type="number" step="0.01" {...register('prix_location_min')} error={errors.prix_location_min?.message} />
                <Input label={t('locationPriceMax')} type="number" step="0.01" {...register('prix_location_max')} error={errors.prix_location_max?.message} />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('articlePhoto')}</label>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                />
                {photoError && <p className="text-red-600 text-sm mt-1">{photoError}</p>}
                {photoPreview && (
                    <div className="mt-3 h-24 w-24 rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                        <img src={photoPreview} alt="Article preview" className="h-full w-full object-cover" />
                    </div>
                )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-200 mt-6">
                <Button type="button" variant="secondary" onClick={onCancel} className="w-full sm:w-auto">{t('cancel')}</Button>
                <Button type="submit" disabled={saving} className="w-full sm:w-auto">{saving ? t('saving') : t('save')}</Button>
            </div>
        </form>
    )
}
