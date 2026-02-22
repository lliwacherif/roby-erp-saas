import { Fragment, useState, useEffect } from 'react'
import { Combobox, Transition } from '@headlessui/react'
import { Check, ChevronsUpDown, UserPlus, User, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/db'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'

type Client = Database['public']['Tables']['clients']['Row']

interface ClientSelectProps {
    value: string
    onChange: (value: string) => void
    label?: string
    error?: string
}

export function ClientSelect({ value, onChange, label, error }: ClientSelectProps) {
    const [query, setQuery] = useState('')
    const [clients, setClients] = useState<Client[]>([])
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newClientName, setNewClientName] = useState('')
    const [newClientPhone, setNewClientPhone] = useState('')
    const [loading, setLoading] = useState(false)
    const { currentTenant } = useTenant()
    const { t } = useI18n()

    useEffect(() => {
        if (currentTenant) fetchClients()
    }, [currentTenant])

    useEffect(() => {
        if (value) {
            const c = clients.find(c => c.id === value)
            if (c) setSelectedClient(c)
        } else {
            setSelectedClient(null)
        }
    }, [value, clients])

    const fetchClients = async () => {
        if (!currentTenant) return
        const { data } = await supabase.from('clients').select('*').eq('tenant_id', currentTenant.id).order('full_name')
        if (data) setClients(data as Client[])
    }

    const handleCreateClient = async () => {
        if (!newClientName || !currentTenant) return
        setLoading(true)
        const { data, error } = await supabase.from('clients').insert({
            tenant_id: currentTenant.id,
            full_name: newClientName,
            phone: newClientPhone || null
        }).select().single()

        if (data) {
            const newClient = data as Client
            setClients([...clients, newClient])
            setSelectedClient(newClient)
            onChange(newClient.id)
            setIsModalOpen(false)
            setNewClientName('')
            setNewClientPhone('')
        } else {
            alert(error?.message)
        }
        setLoading(false)
    }

    const filteredClients =
        query === ''
            ? clients
            : clients.filter((client) =>
                client.full_name
                    .toLowerCase()
                    .replace(/\s+/g, '')
                    .includes(query.toLowerCase().replace(/\s+/g, ''))
            )

    return (
        <div className="w-full relative">
            {label && <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>}
            <div className="relative group">
                <Combobox value={selectedClient} onChange={(c) => { setSelectedClient(c); if (c) onChange(c.id); }}>
                    <div className="relative">
                        <div className="relative w-full cursor-default overflow-hidden rounded-xl bg-white text-left border border-slate-200 shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 group-hover:border-slate-300">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                {selectedClient ? (
                                    <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                        {selectedClient.full_name?.charAt(0).toUpperCase()}
                                    </div>
                                ) : (
                                    <Search className="h-4 w-4" />
                                )}
                            </span>
                            <Combobox.Input
                                className="w-full border-none py-3 pl-11 pr-10 text-sm leading-5 text-slate-900 focus:ring-0 placeholder:text-slate-400"
                                displayValue={(client: Client) => client?.full_name}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={t('selectClient') || "Search or select a client..."}
                            />
                            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <ChevronsUpDown
                                    className="h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors"
                                    aria-hidden="true"
                                />
                            </Combobox.Button>
                        </div>
                        <Transition
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100 translate-y-0"
                            leaveTo="opacity-0 translate-y-1"
                            afterLeave={() => setQuery('')}
                        >
                            <Combobox.Options className="absolute mt-2 max-h-60 w-full overflow-auto rounded-xl bg-white p-1.5 text-base shadow-xl border border-slate-100 ring-1 ring-black/5 focus:outline-none sm:text-sm z-50">
                                {filteredClients.length === 0 && query !== '' ? (
                                    <div className="relative cursor-default select-none py-3 px-4 text-slate-500 text-center flex flex-col items-center gap-2">
                                        <p>No client found.</p>
                                        <button
                                            className="inline-flex items-center gap-1.5 text-blue-600 font-medium hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                            type="button"
                                            onClick={() => { setNewClientName(query); setIsModalOpen(true); }}
                                        >
                                            <UserPlus className="h-4 w-4" /> Create "{query}"
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            className="relative cursor-pointer select-none py-2.5 px-3 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2.5 font-medium transition-colors mb-1"
                                            onClick={() => setIsModalOpen(true)}
                                        >
                                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600">
                                                <UserPlus className="h-4 w-4" />
                                            </div>
                                            Create New Client
                                        </div>
                                        {filteredClients.map((client) => (
                                            <Combobox.Option
                                                key={client.id}
                                                className={({ active }) =>
                                                    `relative cursor-pointer select-none py-2 px-3 rounded-lg flex items-center gap-3 transition-colors ${active ? 'bg-slate-100' : 'text-slate-900'
                                                    }`
                                                }
                                                value={client}
                                            >
                                                {({ selected, active }) => (
                                                    <>
                                                        <div className={`flex items-center justify-center flex-shrink-0 h-8 w-8 rounded-full text-xs font-bold ${selected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                                                            }`}>
                                                            {client.full_name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden">
                                                            <span className={`block truncate ${selected ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                                {client.full_name}
                                                            </span>
                                                            {client.phone && (
                                                                <span className="block truncate text-xs text-slate-500">
                                                                    {client.phone}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {selected && (
                                                            <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                                                                <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </Combobox.Option>
                                        ))}
                                    </>
                                )}
                            </Combobox.Options>
                        </Transition>
                    </div>
                </Combobox>
            </div>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('createNewClient')}>
                <div className="space-y-4">
                    <Input label={t('fullName')} value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                    <Input label={t('phone')} value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('cancel')}</Button>
                        <Button onClick={handleCreateClient} disabled={loading}>
                            {loading ? t('saving') : t('save')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
