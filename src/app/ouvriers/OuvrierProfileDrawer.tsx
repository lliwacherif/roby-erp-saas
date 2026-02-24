import { Drawer } from '@/components/ui/Drawer'
import { useI18n } from '@/lib/i18n'
import type { Database } from '@/types/db'
import { OuvrierCalendar } from './OuvrierCalendar'
import {
    UserCircle, Briefcase, CreditCard, FileSignature,
    ShieldCheck, Phone, MapPin, Milestone, Building2,
    Calendar, Wallet, Fingerprint, Stethoscope, CalendarDays, Clock
} from 'lucide-react'

type Ouvrier = Database['public']['Tables']['ouvriers']['Row']

interface OuvrierProfileDrawerProps {
    isOpen: boolean
    onClose: () => void
    worker: Ouvrier | null
}

export function OuvrierProfileDrawer({ isOpen, onClose, worker }: OuvrierProfileDrawerProps) {
    const { t } = useI18n()

    if (!worker) return null

    const InfoItem = ({ icon: Icon, label, value }: any) => (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-blue-100 group">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Icon className="h-4 w-4" />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{value || <span className="text-slate-300 italic">N/A</span>}</p>
            </div>
        </div>
    )

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={worker.name}
            size="2xl"
        >
            <div className="p-6 overflow-y-auto h-full space-y-8 pb-20 bg-slate-50/50">

                {/* Header Banner */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 rounded-bl-full -z-10"></div>

                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-3xl font-bold shadow-lg ring-4 ring-white">
                        {worker.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 text-center md:text-left pt-2">
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                            <h2 className="text-2xl font-bold text-slate-900">{worker.name}</h2>
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 tracking-wide w-max mx-auto md:mx-0">
                                {worker.employment_status || t('active')}
                            </span>
                        </div>
                        <p className="text-slate-500 flex items-center justify-center md:justify-start gap-2 text-sm font-medium">
                            <Briefcase className="h-4 w-4" />
                            {worker.job_title || 'Employee'} • {worker.department || 'General'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 1. Personal Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                            <UserCircle className="h-5 w-5 text-indigo-500" />
                            <h3 className="text-lg font-bold text-slate-800">{t('personalInfo')}</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <InfoItem icon={Fingerprint} label={t('cin')} value={worker.cin} />
                            <InfoItem icon={Phone} label={t('workerPhone') || 'Phone'} value={worker.phone} />
                            <InfoItem icon={Calendar} label={t('dateOfBirth')} value={worker.date_of_birth} />
                            <InfoItem icon={MapPin} label={t('address')} value={worker.address} />
                            <div className="grid grid-cols-2 gap-3 pb-3">
                                <div>
                                    <p className="text-xs text-slate-500">{t('maritalStatus')}</p>
                                    <p className="text-sm font-semibold">{t(worker.marital_status?.toLowerCase() as any) || worker.marital_status || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">{t('childrenCount')}</p>
                                    <p className="text-sm font-semibold">{worker.children_count || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Professional Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                            <Briefcase className="h-5 w-5 text-blue-500" />
                            <h3 className="text-lg font-bold text-slate-800">{t('professionalInfo')}</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <InfoItem icon={Building2} label={t('department')} value={worker.department} />
                            <InfoItem icon={UserCircle} label={t('managerName')} value={worker.manager_name} />
                            <InfoItem icon={Milestone} label={t('hiringDate')} value={worker.hiring_date} />
                            <InfoItem icon={FileSignature} label={t('contractType')} value={worker.contract_type} />
                        </div>
                    </div>

                    {/* 3. Salary & Payroll */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                            <Wallet className="h-5 w-5 text-emerald-500" />
                            <h3 className="text-lg font-bold text-slate-800">{t('salaryInfo')}</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <InfoItem icon={CreditCard} label={t('baseSalary')} value={`${worker.salaire_base?.toLocaleString()} DT`} />
                            <InfoItem icon={Calendar} label={t('payDay')} value={`${worker.pay_day || '-'} ${worker.pay_day ? t('dayOfMonth') : ''}`} />
                            <InfoItem icon={Building2} label={t('bankName')} value={worker.bank_name} />
                            <InfoItem icon={Fingerprint} label={t('rib')} value={worker.rib} />
                        </div>
                    </div>

                    {/* 4. Admin & Security */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                            <ShieldCheck className="h-5 w-5 text-slate-700" />
                            <h3 className="text-lg font-bold text-slate-800">{t('adminInfo')} & {t('securityInfo')}</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <InfoItem icon={Calendar} label={t('contractEndDate')} value={worker.contract_end_date} />
                            <InfoItem icon={Clock} label={t('workSchedule')} value={worker.work_schedule} />
                            <InfoItem icon={Milestone} label={t('leaveBalance')} value={worker.leave_balance ? `${worker.leave_balance} Days` : '0 Days'} />
                            <InfoItem icon={Stethoscope} label={t('cnssNumber')} value={worker.cnss_number} />
                            <InfoItem icon={Phone} label={t('emergencyContact')} value={worker.emergency_contact} />
                        </div>
                    </div>
                </div>

                {/* Calendar View */}
                <div className="mt-8 pt-8 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                        <CalendarDays className="h-6 w-6 text-blue-600" />
                        <h3 className="text-xl font-bold text-slate-800">{t('attendance')} — {t('calendarView')}</h3>
                    </div>
                    <OuvrierCalendar ouvrierId={worker.id} />
                </div>
            </div>
        </Drawer>
    )
}
