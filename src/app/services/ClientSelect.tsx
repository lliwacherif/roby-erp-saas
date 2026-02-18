import { Fragment, useState, useEffect } from 'react'
import { Combobox, Transition } from '@headlessui/react'
import { Check, ChevronsUpDown, UserPlus } from 'lucide-react'
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
        <div className="w-full">
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
            <div className="relative">
                <Combobox value={selectedClient} onChange={(c) => { setSelectedClient(c); if (c) onChange(c.id); }}>
                    <div className="relative mt-1">
                        <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
                            <Combobox.Input
                                className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
                                displayValue={(client: Client) => client?.full_name}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                                <ChevronsUpDown
                                    className="h-5 w-5 text-gray-400"
                                    aria-hidden="true"
                                />
                            </Combobox.Button>
                        </div>
                        <Transition
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                            afterLeave={() => setQuery('')}
                        >
                            <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-50">
                                {filteredClients.length === 0 && query !== '' ? (
                                    <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                                        Nothing found. <button className="text-blue-600 font-bold" type="button" onClick={() => setIsModalOpen(true)}>Create "{query}"</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative cursor-pointer select-none py-2 px-4 text-gray-700 border-b hover:bg-gray-100 flex items-center gap-2" onClick={() => setIsModalOpen(true)}>
                                            <UserPlus className="h-4 w-4" /> Create New Client
                                        </div>
                                        {filteredClients.map((client) => (
                                            <Combobox.Option
                                                key={client.id}
                                                className={({ active }) =>
                                                    `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-900'
                                                    }`
                                                }
                                                value={client}
                                            >
                                                {({ selected, active }) => (
                                                    <>
                                                        <span
                                                            className={`block truncate ${selected ? 'font-medium' : 'font-normal'
                                                                }`}
                                                        >
                                                            {client.full_name}
                                                        </span>
                                                        {selected ? (
                                                            <span
                                                                className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-blue-600'
                                                                    }`}
                                                            >
                                                                <Check className="h-5 w-5" aria-hidden="true" />
                                                            </span>
                                                        ) : null}
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
