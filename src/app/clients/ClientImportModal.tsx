import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'
import { useTenant } from '@/lib/tenant'
import { supabase } from '@/lib/supabase'
import Papa from 'papaparse'
import { UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react'

// Expected CSV Columns
const REQUIRED_COLS = ['full_name', 'phone']
const OPTIONAL_COLS = ['cin', 'age', 'address', 'email']
const ALL_COLS = [...REQUIRED_COLS, ...OPTIONAL_COLS]

interface ClientImportModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function ClientImportModal({ isOpen, onClose, onSuccess }: ClientImportModalProps) {
    const { t } = useI18n()
    const { currentTenant } = useTenant()

    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0])
            setError(null)
        }
    }

    const downloadTemplate = () => {
        const header = ALL_COLS.join(',') + '\n'
        const sample = 'John Doe,21612345678,12345678,35,Tunis,john@example.com\n'
        const blob = new Blob([header + sample], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'clients_template.csv')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleUpload = () => {
        if (!file || !currentTenant) return

        setIsUploading(true)
        setError(null)

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const { data, meta } = results

                // Validate headers
                const headers = meta.fields || []
                const missingRequired = REQUIRED_COLS.filter(col => !headers.includes(col))

                if (missingRequired.length > 0) {
                    setError(`${t('csvFormatError')} Missing: ${missingRequired.join(', ')}`)
                    setIsUploading(false)
                    return
                }

                // Map data to Supabase format
                const clientsToInsert = data.map((row: any) => {
                    const mapped: any = {
                        tenant_id: currentTenant.id,
                        full_name: row.full_name?.trim(),
                        phone: row.phone?.trim() || null,
                    }
                    if (row.cin?.trim()) mapped.cin = row.cin.trim()
                    if (row.address?.trim()) mapped.address = row.address.trim()
                    if (row.email?.trim()) mapped.email = row.email.trim()
                    if (row.age?.trim() && !isNaN(Number(row.age))) mapped.age = Number(row.age.trim())

                    return mapped
                }).filter((c: any) => c.full_name) // Skip completely empty rows without names

                if (clientsToInsert.length === 0) {
                    setError('No valid clients found in the CSV.')
                    setIsUploading(false)
                    return
                }

                // Bulk Insert
                const { error: dbError } = await supabase
                    .from('clients')
                    .insert(clientsToInsert)

                if (dbError) {
                    setError(t('importCsvError') + dbError.message)
                    setIsUploading(false)
                } else {
                    alert(t('importCsvSuccess').replace('{count}', clientsToInsert.length.toString()))
                    setIsUploading(false)
                    setFile(null)
                    onSuccess()
                    onClose()
                }
            },
            error: (err) => {
                setError(t('importCsvError') + err.message)
                setIsUploading(false)
            }
        })
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('importCsvTitle')}>
            <div className="space-y-6">

                {/* Instructions Box */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                            <p className="text-sm text-blue-800 font-medium mb-2">
                                {t('importCsvInstructions')}
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="font-semibold text-blue-900 border-b border-blue-200">{t('importCsvRequired')}</span>
                                    <ul className="mt-1 space-y-1 text-blue-700 font-mono">
                                        {REQUIRED_COLS.map(c => <li key={c}>- {c}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <span className="font-semibold text-blue-900 border-b border-blue-200">{t('importCsvOptional')}</span>
                                    <ul className="mt-1 space-y-1 text-blue-700 font-mono">
                                        {OPTIONAL_COLS.map(c => <li key={c}>- {c}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-blue-100 flex justify-end">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={downloadTemplate}
                            className="text-blue-700 bg-white hover:bg-blue-100"
                        >
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            {t('downloadTemplate')}
                        </Button>
                    </div>
                </div>

                {/* Upload Zone */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('uploadFile')}</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-slate-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-50 file:text-blue-700
                                hover:file:bg-blue-100 transition-all cursor-pointer"
                        />
                    </div>
                    {error && (
                        <p className="mt-3 text-sm text-red-600 font-medium bg-red-50 p-3 rounded-xl border border-red-100">
                            {error}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
                    <Button
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                    >
                        {isUploading ? (
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        ) : (
                            <UploadCloud className="h-4 w-4 mr-2" />
                        )}
                        {t('importCsv')}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
