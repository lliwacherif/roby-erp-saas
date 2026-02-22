import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Printer } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

type SalaryPaymentData = {
    id: string
    amount: number
    period: string
    paid_at: string | null
    created_at: string
}

type OuvrierData = {
    name: string
    cin: string
    salaire_base: number
    joined_at: string | null
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

export default function FichePaieBuilder() {
    const navigate = useNavigate()
    const { id } = useParams()
    const { currentTenant } = useTenant()
    const { t } = useI18n()

    const [loading, setLoading] = useState(true)
    const [payment, setPayment] = useState<SalaryPaymentData | null>(null)
    const [worker, setWorker] = useState<OuvrierData | null>(null)
    const [profile, setProfile] = useState<CompanyProfile>(emptyProfile)
    const [error, setError] = useState('')

    useEffect(() => {
        if (currentTenant && id) {
            loadAll()
        }
    }, [currentTenant, id])

    const loadAll = async () => {
        if (!currentTenant || !id) return
        setLoading(true)
        setError('')

        // 1. Fetch Salary Payment
        const { data: paymentData, error: paymentError } = await supabase
            .from('salary_payments')
            .select('id, amount, period, paid_at, created_at, ouvrier_id')
            .eq('tenant_id', currentTenant.id)
            .eq('id', id)
            .single()

        if (paymentError || !paymentData) {
            setError(t('noPayments') || 'Payment not found')
            setLoading(false)
            return
        }

        // 2. Fetch Worker Details
        const { data: workerData } = await supabase
            .from('ouvriers')
            .select('name, cin, salaire_base, joined_at')
            .eq('tenant_id', currentTenant.id)
            .eq('id', paymentData.ouvrier_id)
            .single()

        // 3. Fetch Company Profile
        const { data: profileData } = await supabase
            .from('tenant_company_profiles')
            .select('company_name, company_address, company_phone, company_email, company_tax_id')
            .eq('tenant_id', currentTenant.id)
            .maybeSingle()

        setPayment(paymentData as SalaryPaymentData)
        setWorker((workerData as OuvrierData) || null)
        setProfile({
            company_name: profileData?.company_name || '',
            company_address: profileData?.company_address || '',
            company_phone: profileData?.company_phone || '',
            company_email: profileData?.company_email || '',
            company_tax_id: profileData?.company_tax_id || '',
        })
        setLoading(false)
    }

    if (loading) return <div className="p-8 text-center text-slate-500">{t('loading') || 'Loading...'}</div>
    if (!payment || !worker) return <div className="p-8 text-center text-red-500">{error || 'Data not found'}</div>

    return (
        <div className="space-y-6">
            <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
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
          .print-hidden { display: none !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

            {/* Header / Actions - Hidden on Print */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print-hidden border-b pb-4">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <button
                        onClick={() => navigate('/app/ouvriers')}
                        className="flex items-center justify-center h-10 w-10 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{t('payslipTitle') || 'Fiche de Paie'}</h1>
                        <p className="text-sm text-slate-500">ID: {payment.id.slice(0, 8)}</p>
                    </div>
                </div>
                <div className="flex w-full sm:w-auto">
                    <Button onClick={() => window.print()} className="w-full sm:w-auto">
                        <Printer className="h-4 w-4 mr-1.5" />
                        {t('printPayslip') || 'Imprimer'}
                    </Button>
                </div>
            </div>

            {/* A4 Payslip Container */}
            <div className="print-area bg-white mx-auto rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full max-w-[210mm] min-h-[297mm]">
                <div className="p-8 sm:p-12 h-full flex flex-col">

                    {/* Fiche de Paie Header */}
                    <div className="flex justify-between items-start mb-12">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 tracking-tight uppercase">
                                {t('payslipTitle') || 'Fiche de Paie'}
                            </h2>
                            <p className="text-slate-500 mt-1">{t('period') || 'Période'}: <span className="font-medium text-slate-700">{payment.period}</span></p>
                        </div>
                        <div className="text-right">
                            <h3 className="font-bold text-slate-900 text-xl">{profile.company_name || 'Votre Entreprise'}</h3>
                            <div className="text-sm text-slate-500 mt-1 space-y-0.5">
                                {profile.company_address && <p>{profile.company_address}</p>}
                                {profile.company_phone && <p>{profile.company_phone}</p>}
                                {profile.company_email && <p>{profile.company_email}</p>}
                                {profile.company_tax_id && <p>MF: {profile.company_tax_id}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Worker Info */}
                    <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 mb-10">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                            {t('employeeDetails') || 'Détails de l\'Employé'}
                        </h4>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                            <div>
                                <p className="text-sm text-slate-500">{t('workerName') || 'Nom Complet'}</p>
                                <p className="font-semibold text-slate-900 text-lg">{worker.name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">{t('cin') || 'CIN'}</p>
                                <p className="font-medium text-slate-900">{worker.cin || '-'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">{t('joinDate') || 'Date d\'embauche'}</p>
                                <p className="font-medium text-slate-900">
                                    {worker.joined_at ? new Date(worker.joined_at).toLocaleDateString('fr-FR') : '-'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Salary Details Table */}
                    <div className="mb-12 flex-grow">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-slate-200">
                                    <th className="pb-3 text-sm font-bold text-slate-900">{t('description') || 'Description'}</th>
                                    <th className="pb-3 text-sm font-bold text-slate-900 text-right">{t('amount') || 'Montant'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <tr>
                                    <td className="py-4 text-slate-700 font-medium">
                                        {t('baseSalary') || 'Salaire de Base'}
                                    </td>
                                    <td className="py-4 text-slate-900 text-right tabular-nums">
                                        {fmt(worker.salaire_base)} DT
                                    </td>
                                </tr>
                                {payment.amount !== worker.salaire_base && (
                                    <tr>
                                        <td className="py-4 text-slate-700 italic">
                                            {payment.amount > worker.salaire_base ? 'Prime / Majoration' : 'Déduction / Avance'}
                                        </td>
                                        <td className="py-4 text-slate-900 text-right tabular-nums italic">
                                            {fmt(payment.amount - worker.salaire_base)} DT
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Total Net */}
                    <div className="flex justify-end pt-6 border-t border-slate-200">
                        <div className="w-64">
                            <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl">
                                <span className="font-medium text-slate-200">{t('netSalary') || 'Net à Payer'}</span>
                                <span className="text-xl font-bold tabular-nums tracking-tight">
                                    {fmt(payment.amount)} DT
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Warning / Date */}
                    <div className="mt-16 text-center text-sm text-slate-400">
                        <p>{t('paidOn') || 'Payé le'} {new Date(payment.paid_at || payment.created_at).toLocaleDateString('fr-FR')}</p>
                        <p className="mt-2 text-xs">Document généré par ROBY ERP</p>
                    </div>

                </div>
            </div>
        </div>
    )
}
