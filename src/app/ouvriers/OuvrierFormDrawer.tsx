import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Drawer } from '@/components/ui/Drawer'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/db'
import { useTenant } from '@/lib/tenant'

type Ouvrier = Database['public']['Tables']['ouvriers']['Row']

const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    cin: z.string().min(1, 'CIN is required'),
    phone: z.string().optional().or(z.literal('')),
    salaire_base: z.coerce.number().min(0, 'Must be positive'),
    joined_at: z.string().optional().or(z.literal('')),
    pay_day: z.coerce.number().min(1).max(28).optional().or(z.literal(0)),

    // Personal
    date_of_birth: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    marital_status: z.string().optional().or(z.literal('')),
    children_count: z.coerce.number().min(0).optional(),

    // Professional
    employee_id: z.string().optional().or(z.literal('')),
    job_title: z.string().optional().or(z.literal('')),
    department: z.string().optional().or(z.literal('')),
    contract_type: z.string().optional().or(z.literal('')),
    hiring_date: z.string().optional().or(z.literal('')),
    manager_name: z.string().optional().or(z.literal('')),
    work_location: z.string().optional().or(z.literal('')),

    // Salary
    payment_method: z.string().optional().or(z.literal('')),
    bank_name: z.string().optional().or(z.literal('')),
    rib: z.string().optional().or(z.literal('')),

    // Admin
    employment_status: z.string().optional().or(z.literal('')),
    contract_end_date: z.string().optional().or(z.literal('')),
    work_schedule: z.string().optional().or(z.literal('')),
    leave_balance: z.coerce.number().min(0).optional(),

    // Security
    cnss_number: z.string().optional().or(z.literal('')),
    emergency_contact: z.string().optional().or(z.literal('')),
    internal_notes: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

interface OuvrierFormDrawerProps {
    isOpen: boolean
    onClose: () => void
    worker?: Ouvrier | null
    onSuccess: () => void
}

export function OuvrierFormDrawer({ isOpen, onClose, worker, onSuccess }: OuvrierFormDrawerProps) {
    const { t } = useI18n()
    const { currentTenant } = useTenant()
    const [isSaving, setIsSaving] = useState(false)

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema)
    })

    useEffect(() => {
        if (isOpen) {
            if (worker) {
                reset({
                    name: worker.name || '',
                    cin: worker.cin || '',
                    phone: worker.phone || '',
                    salaire_base: worker.salaire_base || 0,
                    joined_at: worker.joined_at || '',
                    pay_day: worker.pay_day || undefined,
                    date_of_birth: worker.date_of_birth || '',
                    address: worker.address || '',
                    marital_status: worker.marital_status || '',
                    children_count: worker.children_count || 0,
                    employee_id: worker.employee_id || '',
                    job_title: worker.job_title || '',
                    department: worker.department || '',
                    contract_type: worker.contract_type || '',
                    hiring_date: worker.hiring_date || '',
                    manager_name: worker.manager_name || '',
                    work_location: worker.work_location || '',
                    payment_method: worker.payment_method || '',
                    bank_name: worker.bank_name || '',
                    rib: worker.rib || '',
                    employment_status: worker.employment_status || 'Active',
                    contract_end_date: worker.contract_end_date || '',
                    work_schedule: worker.work_schedule || '',
                    leave_balance: worker.leave_balance || 0,
                    cnss_number: worker.cnss_number || '',
                    emergency_contact: worker.emergency_contact || '',
                    internal_notes: worker.internal_notes || ''
                })
            } else {
                reset({
                    name: '', cin: '', phone: '', salaire_base: 0, joined_at: '', pay_day: undefined,
                    date_of_birth: '', address: '', marital_status: '', children_count: 0,
                    employee_id: '', job_title: '', department: '', contract_type: '', hiring_date: '',
                    manager_name: '', work_location: '', payment_method: '', bank_name: '', rib: '',
                    employment_status: 'Active', contract_end_date: '', work_schedule: '', leave_balance: 0,
                    cnss_number: '', emergency_contact: '', internal_notes: ''
                })
            }
        }
    }, [isOpen, worker, reset])

    const onSubmit = async (data: FormData) => {
        if (!currentTenant) return
        setIsSaving(true)

        const payload: any = {
            tenant_id: currentTenant.id,
            name: data.name,
            cin: data.cin,
            phone: data.phone || null,
            salaire_base: data.salaire_base,
            joined_at: data.joined_at || null,
            pay_day: data.pay_day || null,
            date_of_birth: data.date_of_birth || null,
            address: data.address || null,
            marital_status: data.marital_status || null,
            children_count: data.children_count || 0,
            employee_id: data.employee_id || null,
            job_title: data.job_title || null,
            department: data.department || null,
            contract_type: data.contract_type || null,
            hiring_date: data.hiring_date || null,
            manager_name: data.manager_name || null,
            work_location: data.work_location || null,
            payment_method: data.payment_method || null,
            bank_name: data.bank_name || null,
            rib: data.rib || null,
            employment_status: data.employment_status || 'Active',
            contract_end_date: data.contract_end_date || null,
            work_schedule: data.work_schedule || null,
            leave_balance: data.leave_balance || 0,
            cnss_number: data.cnss_number || null,
            emergency_contact: data.emergency_contact || null,
            internal_notes: data.internal_notes || null
        }

        let error;
        if (worker?.id) {
            const res = await supabase.from('ouvriers').update(payload).eq('id', worker.id)
            error = res.error
        } else {
            const res = await supabase.from('ouvriers').insert(payload)
            error = res.error
        }

        setIsSaving(false)
        if (!error) {
            onSuccess()
            onClose()
        } else {
            alert(error.message)
        }
    }

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={worker ? t('editWorker') : t('newWorker')}
            size="2xl"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto h-full flex flex-col pb-24">
                <div className="space-y-8 flex-1">

                    {/* 1. Personal Information */}
                    <section>
                        <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">{t('personalInfo')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label={`* ${t('workerName')}`} {...register('name')} error={errors.name?.message} />
                            <Input label={`* ${t('cin')}`} {...register('cin')} error={errors.cin?.message} />
                            <Input label={t('workerPhone') || 'Phone'} {...register('phone')} />
                            <Input label={t('dateOfBirth')} type="date" {...register('date_of_birth')} />
                            <div className="col-span-1 md:col-span-2">
                                <Input label={t('address')} {...register('address')} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('maritalStatus')}</label>
                                <select {...register('marital_status')} className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors">
                                    <option value="">--</option>
                                    <option value="Single">{t('single')}</option>
                                    <option value="Married">{t('married')}</option>
                                    <option value="Divorced">{t('divorced')}</option>
                                    <option value="Widowed">{t('widowed')}</option>
                                </select>
                            </div>
                            <Input label={t('childrenCount')} type="number" {...register('children_count')} />
                        </div>
                    </section>

                    {/* 2. Professional Information */}
                    <section>
                        <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">{t('professionalInfo')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label={t('employeeId')} {...register('employee_id')} />
                            <Input label={t('jobTitle')} {...register('job_title')} />
                            <Input label={t('department')} {...register('department')} />
                            <Input label={t('managerName')} {...register('manager_name')} />

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('contractType')}</label>
                                <select {...register('contract_type')} className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors">
                                    <option value="">--</option>
                                    <option value="CDI">{t('cdi')}</option>
                                    <option value="CDD">{t('cdd')}</option>
                                    <option value="Internship">{t('internship')}</option>
                                    <option value="Freelance">{t('freelance')}</option>
                                </select>
                            </div>
                            <Input label={t('hiringDate')} type="date" {...register('hiring_date')} />
                            <div className="col-span-1 md:col-span-2">
                                <Input label={t('workLocation')} {...register('work_location')} />
                            </div>
                        </div>
                    </section>

                    {/* 3. Salary & Payroll */}
                    <section>
                        <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">{t('salaryInfo')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label={`* ${t('baseSalary')}`} type="number" step="0.001" {...register('salaire_base')} error={errors.salaire_base?.message} />
                            <Input label={t('payDay')} type="number" min={1} max={28} {...register('pay_day')} placeholder="1-28" />

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('paymentMethod')}</label>
                                <select {...register('payment_method')} className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors">
                                    <option value="">--</option>
                                    <option value="Bank Transfer">{t('bankTransfer')}</option>
                                    <option value="Cash">{t('cash')}</option>
                                    <option value="Check">{t('check')}</option>
                                </select>
                            </div>
                            <Input label={t('bankName')} {...register('bank_name')} />
                            <div className="col-span-1 md:col-span-2">
                                <Input label={t('rib')} {...register('rib')} />
                            </div>
                        </div>
                    </section>

                    {/* 4. Administrative Management */}
                    <section>
                        <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">{t('adminInfo')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('employmentStatus')}</label>
                                <select {...register('employment_status')} className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors">
                                    <option value="Active">{t('active')}</option>
                                    <option value="Suspended">{t('suspended')}</option>
                                    <option value="Terminated">{t('terminated')}</option>
                                </select>
                            </div>
                            <Input label={t('contractEndDate')} type="date" {...register('contract_end_date')} />

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('workSchedule')}</label>
                                <select {...register('work_schedule')} className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors">
                                    <option value="">--</option>
                                    <option value="Fixed">{t('fixed')}</option>
                                    <option value="Shift">{t('shift')}</option>
                                    <option value="Part-Time">{t('partTime')}</option>
                                </select>
                            </div>
                            <Input label={t('leaveBalance')} type="number" step="0.5" {...register('leave_balance')} />
                        </div>
                    </section>

                    {/* 5. Security & Control */}
                    <section>
                        <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">{t('securityInfo')}</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label={t('cnssNumber')} {...register('cnss_number')} />
                                <Input label={t('emergencyContact')} {...register('emergency_contact')} />
                            </div>
                            <div className="flex flex-col">
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('internalNotes')}</label>
                                <textarea
                                    {...register('internal_notes')}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors min-h-[100px] resize-y"
                                ></textarea>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex justify-end gap-3 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
                        {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? t('saving') || 'Saving...' : t('save')}
                    </Button>
                </div>
            </form>
        </Drawer>
    )
}
