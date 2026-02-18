import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'
import { Globe } from 'lucide-react'
import robyLogo from '@/assets/Roby Logo.png'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const location = useLocation()
    const { t, locale, setLocale } = useI18n()

    const from = (location.state as any)?.from?.pathname || '/app'

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            const userId = data.user?.id
            if (!userId) {
                navigate('/app', { replace: true })
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('is_root')
                .eq('user_id', userId)
                .maybeSingle()

            if (profile?.is_root) {
                navigate('/root/tenants', { replace: true })
                return
            }

            const targetPath = from.startsWith('/root') ? '/app' : from
            navigate(targetPath, { replace: true })
        }
    }

    return (
        <div className="min-h-screen flex">
            {/* Left Panel — Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 items-center justify-center p-12 overflow-hidden">
                {/* Background decorations */}
                <div className="absolute top-0 left-0 w-full h-full">
                    <div className="absolute top-1/4 -left-12 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-400/5 rounded-full blur-2xl" />
                </div>

                <div className="relative z-10 text-center">
                    <img src={robyLogo} alt="ROBY" className="h-28 w-auto mx-auto mb-8 drop-shadow-2xl" />
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent mb-4">
                        ROBY ERP
                    </h1>
                    <p className="text-blue-200/70 text-lg max-w-sm mx-auto leading-relaxed">
                        {locale === 'fr'
                            ? 'Gérez votre entreprise en toute simplicité avec une plateforme moderne et puissante.'
                            : 'Manage your business with ease using a modern, powerful platform.'
                        }
                    </p>
                </div>
            </div>

            {/* Right Panel — Login Form */}
            <div className="flex-1 flex flex-col">
                {/* Language switcher at top-right */}
                <div className="flex justify-end p-6">
                    <button
                        onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all duration-200"
                    >
                        <Globe className="h-4 w-4" />
                        <span>{locale === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}</span>
                    </button>
                </div>

                <div className="flex-1 flex items-center justify-center px-6 pb-12">
                    <div className="w-full max-w-sm">
                        {/* Mobile Logo */}
                        <div className="lg:hidden flex justify-center mb-8">
                            <img src={robyLogo} alt="ROBY" className="h-16 w-auto" />
                        </div>

                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                                {t('signInTitle')} 👋
                            </h2>
                            <p className="mt-2 text-sm text-slate-500">
                                {t('signInSubtitle')}
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                                    {t('email')}
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none hover:border-slate-300"
                                    placeholder="name@company.com"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                                    {t('password')}
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none hover:border-slate-300"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:from-blue-700 hover:to-blue-800 hover:shadow-xl hover:shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {loading ? t('signingIn') : t('signIn')}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
