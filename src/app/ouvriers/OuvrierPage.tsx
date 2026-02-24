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
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash, Wallet, AlertCircle, CheckCircle2, Clock, X, Printer, UserCircle } from 'lucide-react'

import { OuvrierFormDrawer } from './OuvrierFormDrawer'
import { OuvrierProfileDrawer } from './OuvrierProfileDrawer'

type Ouvrier = Database['public']['Tables']['ouvriers']['Row']
type SalaryPayment = Database['public']['Tables']['salary_payments']['Row']

function getPaymentCycle(now: Date, payDay: number) {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    let cycleYear = now.getFullYear()
    let cycleMonth = now.getMonth() + 1

    if (now.getDate() < payDay) {
        cycleMonth -= 1
        if (cycleMonth === 0) {
            cycleMonth = 12
            cycleYear -= 1
        }
    }

    return `${cycleYear}-${String(cycleMonth).padStart(2, '0')}`
}

export function getNextPaymentDate(ouvrier: Ouvrier): Date | null {
    if (!ouvrier.pay_day) return null;
    const now = new Date();
    const currentDay = now.getDate();

    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth();

    if (currentDay > ouvrier.pay_day) {
        targetMonth += 1;
        if (targetMonth > 11) {
            targetMonth = 0;
            targetYear += 1;
        }
    }

    return new Date(targetYear, targetMonth, ouvrier.pay_day);
}

function getPaymentStatus(ouvrier: Ouvrier, payments: SalaryPayment[]): 'paid' | 'due' | 'overdue' | 'none' {
    if (!ouvrier.pay_day) return 'none'

    const now = new Date();
    const lastPayday = new Date(now.getFullYear(), now.getMonth(), ouvrier.pay_day);
    if (now.getDate() < ouvrier.pay_day) {
        lastPayday.setMonth(lastPayday.getMonth() - 1);
    }

    if (ouvrier.joined_at) {
        const joinDate = new Date(ouvrier.joined_at);
        joinDate.setHours(0, 0, 0, 0);
        if (joinDate >= lastPayday) {
            return 'none';
        }
    }

    const currentPeriod = getPaymentCycle(now, ouvrier.pay_day)
    const isPaid = payments.some(p => p.ouvrier_id === ouvrier.id && p.period === currentPeriod)

    if (isPaid) return 'paid'

    const today = now.getDate()

    if (today > ouvrier.pay_day) return 'overdue';
    if (today === ouvrier.pay_day) return 'due';

    return 'none';
}

export default function OuvrierPage() {
    const [ouvriers, setOuvriers] = useState<Ouvrier[]>([])
    const [loading, setLoading] = useState(true)
    const { currentTenant } = useTenant()
    const { t } = useI18n()
    const navigate = useNavigate()

    // Drawers State
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isProfileOpen, setIsProfileOpen] = useState(false)
    const [selectedWorkerForForm, setSelectedWorkerForForm] = useState<Ouvrier | null>(null)
    const [selectedWorkerForProfile, setSelectedWorkerForProfile] = useState<Ouvrier | null>(null)

    // Salary state
    const [salaryModalOpen, setSalaryModalOpen] = useState(false)
    const [historyModalOpen, setHistoryModalOpen] = useState(false)
    const [selectedWorkerForSalary, setSelectedWorkerForSalary] = useState<Ouvrier | null>(null)
    const [payments, setPayments] = useState<SalaryPayment[]>([])
    const [workerPayments, setWorkerPayments] = useState<SalaryPayment[]>([])
    const [paymentNote, setPaymentNote] = useState('')
    const [markingPaid, setMarkingPaid] = useState(false)

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
        const { data } = await supabase
            .from('salary_payments')
            .select('*')
            .eq('tenant_id', currentTenant.id)
            .order('period', { ascending: false })
            .limit(1000)
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

    const workersNeedingPayment = useMemo(() => {
        return ouvriers.filter(o => {
            const status = getPaymentStatus(o, payments)
            return status === 'overdue' || status === 'due'
        })
    }, [ouvriers, payments])

    // Dashboard Alerts State (Example adding Contracts Ending calculations)
    const contractsEndingSoon = useMemo(() => {
        const now = new Date()
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

        return ouvriers.filter(o => {
            if (!o.contract_end_date) return false
            const endDate = new Date(o.contract_end_date)
            return endDate > now && endDate <= thirtyDaysFromNow
        })
    }, [ouvriers])

    const handleEdit = (ouvrier: Ouvrier) => {
        setSelectedWorkerForForm(ouvrier)
        setIsFormOpen(true)
    }

    const handleCreate = () => {
        setSelectedWorkerForForm(null)
        setIsFormOpen(true)
    }

    const handleViewProfile = (ouvrier: Ouvrier) => {
        setSelectedWorkerForProfile(ouvrier)
        setIsProfileOpen(true)
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`${t('deleteConfirmTitle')}\n${name}?`)) return
        const { error } = await supabase.from('ouvriers').delete().eq('id', id)
        if (!error) fetchOuvriers()
        else alert(error.message)
    }

    const openSalaryModal = (ouvrier: Ouvrier) => {
        setSelectedWorkerForSalary(ouvrier)
        setPaymentNote('')
        fetchWorkerPayments(ouvrier.id)
        setSalaryModalOpen(true)
    }

    const handleMarkAsPaid = async () => {
        if (!currentTenant || !selectedWorkerForSalary) return
        setMarkingPaid(true)

        const { error } = await supabase.from('salary_payments').insert({
            tenant_id: currentTenant.id,
            ouvrier_id: selectedWorkerForSalary.id,
            amount: selectedWorkerForSalary.salaire_base,
            period: getPaymentCycle(new Date(), selectedWorkerForSalary.pay_day || 1),
            notes: paymentNote || null
        })

        if (!error) {
            await fetchAllPayments()
            await fetchWorkerPayments(selectedWorkerForSalary.id)
            setPaymentNote('')
        } else {
            alert(error.message)
        }
        setMarkingPaid(false)
    }

    const handleDeletePayment = async (paymentId: string) => {
        if (!confirm(`${t('delete')}?`)) return
        const { error } = await supabase.from('salary_payments').delete().eq('id', paymentId)
        if (!error && selectedWorkerForSalary) {
            await fetchAllPayments()
            await fetchWorkerPayments(selectedWorkerForSalary.id)
        }
    }

    const columns: ColumnDef<Ouvrier>[] = [
        {
            accessorKey: 'name',
            header: t('workerName'),
            cell: ({ row }) => (
                <div
                    onClick={() => handleViewProfile(row.original)}
                    className="font-semibold text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                >
                    {row.original.name}
                </div>
            )
        },
        {
            accessorKey: 'job_title',
            header: t('jobTitle'),
            cell: ({ row }) => <span className="text-slate-600">{row.original.job_title || '—'}</span>
        },
        {
            accessorKey: 'department',
            header: t('department'),
            cell: ({ row }) => <span className="text-slate-600">{row.original.department || '—'}</span>
        },
        {
            accessorKey: 'employment_status',
            header: t('status'),
            cell: ({ row }) => {
                const status = row.original.employment_status || 'Active'
                const colors: Record<string, string> = {
                    'Active': 'bg-emerald-100 text-emerald-700',
                    'Suspended': 'bg-amber-100 text-amber-700',
                    'Terminated': 'bg-slate-100 text-slate-700'
                }
                const color = colors[status] || colors['Active']
                return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                        {t(status.toLowerCase() as any) || status}
                    </span>
                )
            }
        },
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
            cell: ({ row }) => {
                const status = getPaymentStatus(row.original, payments)
                const isPaid = status === 'paid'

                return (
                    <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => handleViewProfile(row.original)} title={t('employeeDetails')} className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50">
                            <UserCircle className="h-4 w-4" />
                        </Button>
                        {!isPaid && row.original.pay_day && (
                            <Button size="sm" variant="ghost" onClick={() => {
                                openSalaryModal(row.original);
                            }} title="Mark as Paid" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                                <CheckCircle2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => {
                            setSelectedWorkerForSalary(row.original);
                            fetchWorkerPayments(row.original.id);
                            setHistoryModalOpen(true);
                        }} title={t('salaryHistory')} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                            <Wallet className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(row.original)}>
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(row.original.id, row.original.name)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )
            }
        }
    ]

    const currentPeriod = selectedWorkerForSalary ? getPaymentCycle(new Date(), selectedWorkerForSalary.pay_day || 1) : '';
    const isCurrentPeriodPaid = selectedWorkerForSalary ? payments.some(p => p.ouvrier_id === selectedWorkerForSalary.id && p.period === currentPeriod) : false

    return (
        <div className="space-y-6">
            {/* Dashboard Alerts Banner */}
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

            {contractsEndingSoon.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-red-800">{t('contractsEnding')} ({contractsEndingSoon.length})</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {contractsEndingSoon.map(w => (
                                <button
                                    key={w.id}
                                    onClick={() => handleViewProfile(w)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 cursor-pointer bg-red-100 text-red-700 hover:bg-red-200"
                                >
                                    {w.name} (Ends: {new Date(w.contract_end_date!).toLocaleDateString()})
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('workersTitle')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{ouvriers.length} {t('workers').toLowerCase()}</p>
                </div>
                <Button onClick={handleCreate} className="w-full sm:w-auto shadow-sm shadow-blue-500/20">
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t('newWorker')}
                </Button>
            </div>

            <div className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm text-slate-700 overflow-hidden">
                <DataTable columns={columns} data={ouvriers} searchKey="name" />
            </div>

            {/* View Profile Drawer */}
            <OuvrierProfileDrawer
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                worker={selectedWorkerForProfile}
            />

            {/* Create/Edit Worker Drawer */}
            <OuvrierFormDrawer
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                worker={selectedWorkerForForm}
                onSuccess={fetchOuvriers}
            />

            {/* Salary Payments Modal */}
            <Modal isOpen={salaryModalOpen} onClose={() => setSalaryModalOpen(false)} title={`${t('salaryPayments')} — ${selectedWorkerForSalary?.name || ''}`}>
                {selectedWorkerForSalary && (
                    <div className="space-y-5">
                        <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="text-slate-400 text-xs">{t('baseSalary')}</span>
                                <p className="font-bold text-slate-900">{selectedWorkerForSalary.salaire_base.toLocaleString()} DT</p>
                            </div>
                            <div>
                                <span className="text-slate-400 text-xs">{t('payDay')}</span>
                                <p className="font-medium text-slate-700">{selectedWorkerForSalary.pay_day || '—'} {selectedWorkerForSalary.pay_day ? t('dayOfMonth') : ''}</p>
                            </div>
                            {selectedWorkerForSalary.joined_at && (
                                <div className="col-span-2">
                                    <span className="text-slate-400 text-xs">{t('joinDate')}</span>
                                    <p className="font-medium text-slate-700">{new Date(selectedWorkerForSalary.joined_at).toLocaleDateString()}</p>
                                </div>
                            )}
                        </div>

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
                                            {isCurrentPeriodPaid ? t('paid') : t('unpaid')} — {selectedWorkerForSalary.salaire_base.toLocaleString()} DT
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
                    </div>
                )}
            </Modal>

            {/* History Modal */}
            <Modal isOpen={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title={`${t('salaryHistory')} — ${selectedWorkerForSalary?.name || ''}`}>
                {selectedWorkerForSalary && (
                    <div className="space-y-4">
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
                                        <div className="flex gap-3 items-center isolate">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); navigate(`/app/ouvriers/payslip/${p.id}`) }}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 hover:scale-105 transition-all rounded-lg font-semibold shadow-sm"
                                                title={t('printPayslip') || 'Print Payslip'}
                                            >
                                                <Printer className="h-4 w-4" />
                                                <span className="text-xs">{t('printPayslip') || 'Imprimer'}</span>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeletePayment(p.id) }}
                                                className="text-slate-400 hover:text-red-600 transition-all p-2 rounded-lg hover:bg-red-50"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}
