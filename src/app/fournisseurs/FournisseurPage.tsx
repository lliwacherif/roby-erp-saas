import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/db'
import { DataTable } from '@/components/ui/DataTable'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'
import { Plus, Pencil, Trash2, Truck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

type Fournisseur = Database['public']['Tables']['fournisseurs']['Row']

export default function FournisseurPage() {
    const { currentTenant } = useTenant()
    const { t } = useI18n()
    const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    const schema = z.object({
        nom: z.string().min(1, t('supplierName') || 'Name is required'),
        contact: z.string().optional().or(z.literal('')),
        immatricule_fiscale: z.string().min(1, t('fiscalId') || 'Fiscal ID is required'),
        telephone: z.string().optional().or(z.literal('')),
        email: z.string().email('Invalid email').optional().or(z.literal('')),
        adresse: z.string().optional().or(z.literal('')),
        notes: z.string().optional().or(z.literal('')),
    })
    type FormData = z.infer<typeof schema>

    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema) as any
    })

    useEffect(() => {
        if (currentTenant) {
            fetchFournisseurs()
        }
    }, [currentTenant])

    const fetchFournisseurs = async () => {
        if (!currentTenant) return
        setLoading(true)
        const { data, error } = await supabase
            .from('fournisseurs')
            .select('*')
            .eq('tenant_id', currentTenant.id)
            .order('nom')

        if (error) console.error(error)
        else if (data) setFournisseurs(data as Fournisseur[])
        setLoading(false)
    }

    const handleEdit = (fournisseur: Fournisseur) => {
        setEditingId(fournisseur.id)
        setValue('nom', fournisseur.nom)
        setValue('contact', fournisseur.contact || '')
        setValue('immatricule_fiscale', fournisseur.immatricule_fiscale || '')
        setValue('telephone', fournisseur.telephone || '')
        setValue('email', fournisseur.email || '')
        setValue('adresse', fournisseur.adresse || '')
        setValue('notes', fournisseur.notes || '')
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm(t('deleteConfirmMessage') || 'Are you sure you want to delete this?')) return
        const { error } = await supabase.from('fournisseurs').delete().eq('id', id)
        if (!error) fetchFournisseurs()
        else alert(error.message)
    }

    const onSubmit = async (data: FormData) => {
        if (!currentTenant) return
        const payload = {
            nom: data.nom,
            contact: data.contact || null,
            immatricule_fiscale: data.immatricule_fiscale || null,
            telephone: data.telephone || null,
            email: data.email || null,
            adresse: data.adresse || null,
            notes: data.notes || null,
        }

        if (editingId) {
            const { error } = await supabase.from('fournisseurs').update({
                ...payload,
                updated_at: new Date().toISOString()
            }).eq('id', editingId)

            if (!error) {
                setIsModalOpen(false)
                reset()
                setEditingId(null)
                fetchFournisseurs()
            } else {
                alert(error.message)
            }
        } else {
            const { error } = await supabase.from('fournisseurs').insert({
                tenant_id: currentTenant.id,
                ...payload
            })

            if (!error) {
                setIsModalOpen(false)
                reset()
                fetchFournisseurs()
            } else {
                alert(error.message)
            }
        }
    }

    const columns: ColumnDef<Fournisseur>[] = [
        {
            accessorKey: 'nom',
            header: t('supplierName') || 'Name',
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Truck className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="font-medium text-slate-900">{row.original.nom}</div>
                        {row.original.email && <div className="text-xs text-slate-500">{row.original.email}</div>}
                    </div>
                </div>
            )
        },
        {
            accessorKey: 'immatricule_fiscale',
            header: t('fiscalId') || 'Fiscal ID',
            cell: ({ row }) => (
                row.original.immatricule_fiscale ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-mono font-medium">
                        {row.original.immatricule_fiscale}
                    </span>
                ) : '-'
            )
        },
        {
            accessorKey: 'contact',
            header: t('contact') || 'Contact',
            cell: ({ row }) => row.original.contact || '-'
        },
        {
            accessorKey: 'telephone',
            header: t('phone') || 'Phone',
            cell: ({ row }) => row.original.telephone || '-'
        },
        {
            id: 'actions',
            header: t('actions'),
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(row.original)}>
                        <Pencil className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(row.original.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('suppliersTitle') || 'Suppliers'}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{fournisseurs.length} {t('registeredSuppliers') || 'registered suppliers'}</p>
                </div>
                <Button onClick={() => { setEditingId(null); reset(); setIsModalOpen(true); }} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t('newSupplier') || 'New Supplier'}
                </Button>
            </div>

            <DataTable columns={columns} data={fournisseurs} searchKey="nom" />

            {/* Create/Edit Supplier Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? t('editSupplier') || 'Edit Supplier' : t('newSupplier') || 'New Supplier'}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <Input label={t('supplierName') || 'Supplier Name'} required {...register('nom')} error={errors.nom?.message} />
                    <Input label={t('fiscalId') || 'Fiscal ID (Immatricule Fiscale)'} required {...register('immatricule_fiscale')} error={errors.immatricule_fiscale?.message} />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input label={t('contact') || 'Contact Person'} {...register('contact')} error={errors.contact?.message} />
                        <Input label={t('phone') || 'Phone'} {...register('telephone')} error={errors.telephone?.message} />
                    </div>

                    <Input label={t('email') || 'Email'} type="email" {...register('email')} error={errors.email?.message} />
                    <Input label={t('address') || 'Address'} {...register('adresse')} error={errors.adresse?.message} />

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('notes') || 'Notes'}</label>
                        <textarea
                            {...register('notes')}
                            className="block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none min-h-[100px]"
                            placeholder={t('optional') || 'Optional notes...'}
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">{t('cancel')}</Button>
                        <Button type="submit" className="w-full sm:w-auto">{t('save')}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
