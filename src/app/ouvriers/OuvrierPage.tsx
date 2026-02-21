import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/db'
import { DataTable } from '@/components/ui/DataTable'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'
import { Plus, Pencil, Trash, Wallet, AlertCircle, CheckCircle2, Clock, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

type Ouvrier = Database['public']['Tables']['ouvriers']['Row']
type SalaryPayment = Database['public']['Tables']['salary_payments']['Row']

const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    cin: z.string().min(1, 'CIN is required'),
    salaire_base: z.coerce.number().min(0),
    joined_at: z.string().optional().or(z.literal('')),
    pay_day: z.coerce.number().min(1).max(28).optional()
})

type FormData = z.infer<typeof schema>

function getCurrentPeriod() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getPaymentStatus(ouvrier: Ouvrier, payments: SalaryPayment[]): 'paid' | 'due' | 'overdue' | 'none' {
    if (!ouvrier.pay_day) return 'none'

    const currentPeriod = getCurrentPeriod()
    const isPaid = payments.some(p => p.ouvrier_id === ouvrier.id && p.period === currentPeriod)
    if (isPaid) return 'paid'

    const today = new Date().getDate()
    if (today >= ouvrier.pay_day) return 'overdue'
    if (today === ouvrier.pay_day - 1 || today === ouvrier.pay_day) return 'due'

    return 'due'
}

export default function OuvrierPage() {
    const [ouvriers, setOuvriers] = useState<Ouvrier[]>([])
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const { currentTenant } = useTenant()
    const { t } = useI18n()

    // Salary state
    const [salaryModalOpen, setSalaryModalOpen] = useState(false)
    const [selectedWorker, setSelectedWorker] = useState<Ouvrier | null>(null)
    const [payments, setPayments] = useState<SalaryPayment[]>([])
    const [workerPayments, setWorkerPayments] = useState<SalaryPayment[]>([])
    const [paymentNote, setPaymentNote] = useState('')
    const [markingPaid, setMarkingPaid] = useState(false)

    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema) as any
    })

    useEffect(() => {
        if (currentTenant) {
            fetchOuvriers()
            fetchAllPayments()
        }
    }, [currentTenant])

    const fetchOuvriers = async () => {
        if (!currentTenant) return
        setLoading(true)
        const { data } = await supabase.from('ouvriers').select('*').eq('tenant_id', currentTenant.id).order('name')
        if (data) setOuvriers(data as Ouvrier[])
        setLoading(false)
    }

    const fetchAllPayments = async () => {
        if (!currentTenant) return
        const currentPeriod = getCurrentPeriod()
        const { data } = await supabase
            .from('salary_payments')
            .select('*')
            .eq('tenant_id', currentTenant.id)
            .eq('period', currentPeriod)
        if (data) setPayments(data as SalaryPayment[])
    }

    const fetchWorkerPayments = async (ouvrierId: string) => {
        if (!currentTenant) return
        const { data } = await supabase
            .from('salary_payments')
            .select('*')
            .eq('tenant_id', currentTenant.id)
            .eq('ouvrier_id', ouvrierId)
            .order('period', { ascending: false })
        if (data) setWorkerPayments(data as SalaryPayment[])
    }

    // Workers needing payment
    const workersNeedingPayment = useMemo(() => {
        return ouvriers.filter(o => {
            const status = getPaymentStatus(o, payments)
            return status === 'overdue' || status === 'due'
        })
    }, [ouvriers, payments])

    const handleEdit = (ouvrier: Ouvrier) => {
        setEditingId(ouvrier.id)
        setValue('name', ouvrier.name)
        setValue('cin', ouvrier.cin)
        setValue('salaire_base', ouvrier.salaire_base)
        setValue('joined_at', ouvrier.joined_at || '')
        setValue('pay_day', ouvrier.pay_day || 1)
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm(`${t('delete')}?`)) return
        const { error } = await supabase.from('ouvriers').delete().eq('id', id)
        if (!error) fetchOuvriers()
        else alert(error.message)
    }

    const onSubmit = async (data: FormData) => {
        if (!currentTenant) return
        const payload = {
            name: data.name,
            cin: data.cin,
            salaire_base: data.salaire_base,
            joined_at: data.joined_at || null,
            pay_day: data.pay_day || null
        }

        if (editingId) {
            const { error } = await supabase.from('ouvriers').update(payload).eq('id', editingId)
            if (!error) { setIsModalOpen(false); reset(); setEditingId(null); fetchOuvriers() }
            else alert(error.message)
        } else {
            const { error } = await supabase.from('ouvriers').insert({ tenant_id: currentTenant.id, ...payload })
            if (!error) { setIsModalOpen(false); reset(); fetchOuvriers() }
            else alert(error.message)
        }
    }

    const openSalaryModal = (ouvrier: Ouvrier) => {
        setSelectedWorker(ouvrier)
        setPaymentNote('')
        fetchWorkerPayments(ouvrier.id)
        setSalaryModalOpen(true)
    }

    const handleMarkAsPaid = async () => {
        if (!currentTenant || !selectedWorker) return
        setMarkingPaid(true)

        const { error } = await supabase.from('salary_payments').insert({
            tenant_id: currentTenant.id,
            ouvrier_id: selectedWorker.id,
            amount: selectedWorker.salaire_base,
            period: getCurrentPeriod(),
            notes: paymentNote || null
        })

        if (!error) {
            await fetchAllPayments()
            await fetchWorkerPayments(selectedWorker.id)
            setPaymentNote('')
        } else {
            alert(error.message)
        }
        setMarkingPaid(false)
    }

    const handleDeletePayment = async (paymentId: string) => {
        if (!confirm(`${t('delete')}?`)) return
        const { error } = await supabase.from('salary_payments').delete().eq('id', paymentId)
        if (!error && selectedWorker) {
            await fetchAllPayments()
            await fetchWorkerPayments(selectedWorker.id)
        }
    }

    const columns: ColumnDef<Ouvrier>[] = [
        { accessorKey: 'name', header: t('workerName') },
        { accessorKey: 'cin', header: t('cin') },
        {
            accessorKey: 'salaire_base', header: t('baseSalary'), cell: ({ getValue }) => (
                <span className="font-semibold text-slate-900">{Number(getValue()).toLocaleString()} DT</span>
            )
        },
        {
            accessorKey: 'pay_day', header: t('payDay'),
            cell: ({ row }) => {
                const payDay = row.original.pay_day
                if (!payDay) return <span className="text-slate-400">—</span>

                const status = getPaymentStatus(row.original, payments)
                const statusConfig = {
                    paid: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2, label: t('paid') },
                    overdue: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle, label: t('overdue') },
                    due: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock, label: t('dueToday') },
                    none: { bg: 'bg-slate-100', text: 'text-slate-500', icon: Clock, label: '' },
                }[status]

                return (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">{payDay} {t('dayOfMonth')}</span>
                        {status !== 'none' && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                                <statusConfig.icon className="h-3 w-3" />
                                {statusConfig.label}
                            </span>
                        )}
                    </div>
                )
            }
        },
        {
            id: 'actions', header: t('actions'),
            cell: ({ row }) => (
                <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => openSalaryModal(row.original)} title={t('salaryPayments')}>
                        <Wallet className="h-3.5 w-3.5 text-blue-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(row.original)}>
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(row.original.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )
        }
    ]

    const currentPeriod = getCurrentPeriod()
    const isCurrentPeriodPaid = selectedWorker ? payments.some(p => p.ouvrier_id === selectedWorker.id && p.period === currentPeriod) : false

    return (
        <div className="space-y-6">
            {/* Payment Due Alert Banner */}
            {workersNeedingPayment.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-800">{t('paymentDueAlert')}</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                            {workersNeedingPayment.length} {t('paymentReminder')}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {workersNeedingPayment.map(w => {
                                const status = getPaymentStatus(w, payments)
                                return (
                                    <button
                                        key={w.id}
                                        onClick={() => openSalaryModal(w)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 cursor-pointer ${status === 'overdue'
                                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                            }`}
                                    >
                                        {status === 'overdue' ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                        {w.name} — {w.salaire_base.toLocaleString()} DT
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('workersTitle')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{ouvriers.length} {t('workers').toLowerCase()}</p>
                </div>
                <Button onClick={() => { setEditingId(null); reset(); setIsModalOpen(true); }} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t('newWorker')}
                </Button>
            </div>
            <DataTable columns={columns} data={ouvriers} searchKey="name" />

            {/* Create/Edit Worker Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? t('editWorker') : t('newWorker')}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <Input label={t('workerName')} {...register('name')} error={errors.name?.message} />
                    <Input label={t('cin')} {...register('cin')} error={errors.cin?.message} />
                    <Input label={t('baseSalary')} type="number" {...register('salaire_base')} error={errors.salaire_base?.message} />
                    <Input label={t('joinDate')} type="date" {...register('joined_at')} />
                    <Input label={t('payDay')} type="number" min={1} max={28} {...register('pay_day')} placeholder="1-28" />

                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">{t('cancel')}</Button>
                        <Button type="submit" className="w-full sm:w-auto">{t('save')}</Button>
                    </div>
                </form>
            </Modal>

            {/* Salary Payments Modal */}
            <Modal isOpen={salaryModalOpen} onClose={() => setSalaryModalOpen(false)} title={`${t('salaryPayments')} — ${selectedWorker?.name || ''}`}>
                {selectedWorker && (
                    <div className="space-y-5">
                        {/* Worker Info Card */}
                        <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="text-slate-400 text-xs">{t('baseSalary')}</span>
                                <p className="font-bold text-slate-900">{selectedWorker.salaire_base.toLocaleString()} DT</p>
                            </div>
                            <div>
                                <span className="text-slate-400 text-xs">{t('payDay')}</span>
                                <p className="font-medium text-slate-700">{selectedWorker.pay_day || '—'} {selectedWorker.pay_day ? t('dayOfMonth') : ''}</p>
                            </div>
                            {selectedWorker.joined_at && (
                                <div className="col-span-2">
                                    <span className="text-slate-400 text-xs">{t('joinDate')}</span>
                                    <p className="font-medium text-slate-700">{new Date(selectedWorker.joined_at).toLocaleDateString()}</p>
                                </div>
                            )}
                        </div>

                        {/* Current Month Payment */}
                        <div className={`rounded-xl p-4 border ${isCurrentPeriodPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {isCurrentPeriodPaid
                                        ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                        : <Clock className="h-5 w-5 text-amber-600" />
                                    }
                                    <div>
                                        <p className="text-sm font-semibold">{currentPeriod}</p>
                                        <p className={`text-xs ${isCurrentPeriodPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {isCurrentPeriodPaid ? t('paid') : t('unpaid')} — {selectedWorker.salaire_base.toLocaleString()} DT
                                        </p>
                                    </div>
                                </div>
                                {!isCurrentPeriodPaid && (
                                    <Button size="sm" onClick={handleMarkAsPaid} disabled={markingPaid}>
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {markingPaid ? '...' : t('markAsPaid')}
                                    </Button>
                                )}
                            </div>

                            {!isCurrentPeriodPaid && (
                                <div className="mt-3">
                                    <Input
                                        placeholder={t('notes') + ' (' + t('note') + ')'}
                                        value={paymentNote}
                                        onChange={(e) => setPaymentNote(e.target.value)}
                                        className="text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Payment History */}
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('salaryHistory')}</h3>
                            {workerPayments.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-4">{t('noPayments')}</p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {workerPayments.map(p => (
                                        <div key={p.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                    <span className="text-sm font-medium text-slate-900">{p.period}</span>
                                                    <span className="text-sm font-bold text-slate-700">{Number(p.amount).toLocaleString()} DT</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5 ml-6">
                                                    <span className="text-xs text-slate-400">{t('paidOn')}: {new Date(p.paid_at).toLocaleDateString()}</span>
                                                    {p.notes && <span className="text-xs text-slate-400">· {p.notes}</span>}
                                                </div>
                                            </div>
                                            <button onClick={() => handleDeletePayment(p.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
