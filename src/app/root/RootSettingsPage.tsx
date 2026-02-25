import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'
import { Settings, CheckCircle2, AlertCircle } from 'lucide-react'

export default function RootSettingsPage() {
    const { t } = useI18n()
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (newPassword.length < 6) {
            setError(t('passwordTooShort'))
            return
        }

        if (newPassword !== confirmPassword) {
            setError(t('passwordMismatch'))
            return
        }

        setLoading(true)

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (updateError) {
                throw updateError
            }

            setSuccess(t('passwordChanged'))
            setNewPassword('')
            setConfirmPassword('')
        } catch (err: any) {
            setError(err.message || 'Failed to update password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                    <Settings className="w-6 h-6 text-slate-700" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('settings')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{t('changePassword')}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                    <h2 className="text-lg font-semibold text-slate-800">{t('changePassword')}</h2>
                </div>

                <form onSubmit={handleUpdatePassword} className="p-6 space-y-5">
                    {error && (
                        <div className="flex items-start gap-2 p-4 text-sm text-red-700 bg-red-50 rounded-lg border border-red-100">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-start gap-2 p-4 text-sm text-green-700 bg-green-50 rounded-lg border border-green-100">
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                            <p>{success}</p>
                        </div>
                    )}

                    <div className="max-w-md space-y-4">
                        <Input
                            type="password"
                            label={t('newPassword')}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                        <Input
                            type="password"
                            label={t('confirmPassword')}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="pt-2">
                        <Button
                            type="submit"
                            disabled={loading || !newPassword || !confirmPassword}
                            className="w-full sm:w-auto"
                        >
                            {loading ? t('updating') : t('updatePassword')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
