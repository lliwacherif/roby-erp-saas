import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, User, Phone, MapPin, CreditCard, Mail, Calendar } from 'lucide-react'
import type { Database } from '@/types/db'

type Client = Database['public']['Tables']['clients']['Row']

// Form schema uses strings for inputs to handle empty states easily
const formSchema = z.object({
    full_name: z.string().min(1, "Name is required"),
    phone: z.string().min(1, "Phone is required"),
    cin: z.string().min(1, "CIN is required"),
    email: z.string().email("Invalid email").optional().or(z.literal('')),
    age: z.string().optional(),
    address: z.string().optional()
})

type FormValues = z.infer<typeof formSchema>

export default function ClientForm() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { t } = useI18n()
    const { currentTenant } = useTenant()
    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(!!id)

    const { register, handleSubmit, formState: { errors }, setValue, reset } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            full_name: '',
            phone: '',
            cin: '',
            email: '',
            age: '',
            address: ''
        }
    })

    useEffect(() => {
        if (id && currentTenant) {
            fetchClient(id)
        }
    }, [id, currentTenant])

    const fetchClient = async (clientId: string) => {
        const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single()
        if (error) {
            console.error(error)
            navigate('/app/clients')
            return
        }
        if (data) {
            const client = data as Client
            reset({
                full_name: client.full_name,
                phone: client.phone || '',
                cin: client.cin || '',
                email: client.email || '',
                age: client.age !== null ? String(client.age) : '',
                address: client.address || ''
            })
        }
        setInitialLoading(false)
    }

    const onSubmit = async (data: FormValues) => {
        if (!currentTenant) return
        setLoading(true)

        const payload = {
            tenant_id: currentTenant.id,
            full_name: data.full_name,
            phone: data.phone || null,
            cin: data.cin || null,
            email: data.email || null,
            // Convert string age to number or null
            age: data.age && data.age.trim() !== '' ? Number(data.age) : null,
            address: data.address || null
        }

        try {
            if (id) {
                const { error } = await supabase.from('clients').update(payload).eq('id', id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('clients').insert(payload)
                if (error) throw error
            }
            navigate('/app/clients')
        } catch (e: any) {
            alert(e.message)
        } finally {
            setLoading(false)
        }
    }

    if (initialLoading) return <div className="p-8 text-center text-slate-500">{t('loading')}</div>

    return (
        <div className="max-w-2xl mx-auto pb-10">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/app/clients')}
                    className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{id ? t('editClient') : t('newClient')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{t('clientDetails')}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-100 text-blue-600">
                                <User className="h-4 w-4" />
                            </div>
                            <h2 className="text-sm font-semibold text-slate-800">{t('personalInfo')}</h2>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Name */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('fullName')} <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                <input
                                    {...register('full_name')}
                                    className="block w-full rounded-lg border-slate-200 pl-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    placeholder="John Doe"
                                />
                            </div>
                            {errors.full_name && <p className="mt-1 text-xs text-red-500">{errors.full_name.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* CIN */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('cin')} <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                    <input
                                        {...register('cin')}
                                        className="block w-full rounded-lg border-slate-200 pl-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Identification Number"
                                    />
                                </div>
                                {errors.cin && <p className="mt-1 text-xs text-red-500">{errors.cin.message}</p>}
                            </div>

                            {/* Phone */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('phone')} <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                    <input
                                        {...register('phone')}
                                        className="block w-full rounded-lg border-slate-200 pl-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="+216 12 345 678"
                                    />
                                </div>
                                {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Age */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('age')}</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                    <input
                                        type="number"
                                        {...register('age')}
                                        className="block w-full rounded-lg border-slate-200 pl-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="e.g. 35"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                    <input
                                        type="email"
                                        {...register('email')}
                                        className="block w-full rounded-lg border-slate-200 pl-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="john@example.com"
                                    />
                                </div>
                                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                            </div>
                        </div>

                        {/* Address */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('address')}</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                <div className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none"></div>
                                <textarea
                                    {...register('address')}
                                    rows={3}
                                    className="block w-full rounded-lg border-slate-200 pl-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm pt-2.5"
                                    placeholder="Full address details..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <Button type="button" variant="secondary" onClick={() => navigate('/app/clients')}>
                        {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={loading} className="px-8 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-600/25">
                        {loading ? t('saving') : t('save')}
                    </Button>
                </div>
            </form>
        </div>
    )
}
