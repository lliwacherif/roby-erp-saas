import { useAuth } from '@/lib/auth'
import { useTenant } from '@/lib/tenant'
import { useI18n } from '@/lib/i18n'
import { LogOut, User, Globe, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export function Topbar({ showTenantSwitcher = false }: { showTenantSwitcher?: boolean }) {
    const { user, signOut, profile } = useAuth()
    const { currentTenant, tenants, startTransition } = useTenant()
    const { locale, setLocale, t } = useI18n()
    const [langOpen, setLangOpen] = useState(false)
    const langRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (langRef.current && !langRef.current.contains(e.target as Node)) {
                setLangOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white/80 backdrop-blur-lg px-6">
            {/* Left — Tenant Switcher */}
            <div className="flex flex-1 items-center">
                {showTenantSwitcher && (
                    <div className="relative">
                        <select
                            id="tenant-select"
                            value={currentTenant?.id || ''}
                            onChange={(e) => startTransition(e.target.value)}
                            className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer"
                        >
                            {tenants.map((tenant) => (
                                <option key={tenant.id} value={tenant.id}>
                                    {tenant.name}
                                </option>
                            ))}
                            {tenants.length === 0 && <option value="">{t('noTenants')}</option>}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                )}
            </div>

            {/* Right — Language + User + Logout */}
            <div className="flex items-center gap-x-3">
                {/* Language Switcher */}
                <div className="relative" ref={langRef}>
                    <button
                        onClick={() => setLangOpen(!langOpen)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200"
                        title={t('language')}
                    >
                        <Globe className="h-4 w-4" />
                        <span className="uppercase text-xs font-semibold">{locale}</span>
                    </button>

                    {langOpen && (
                        <div className="absolute right-0 mt-2 w-36 rounded-xl border border-slate-200 bg-white shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <button
                                onClick={() => { setLocale('fr'); setLangOpen(false) }}
                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors duration-150 ${locale === 'fr' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                                <span className="text-base">🇫🇷</span>
                                Français
                            </button>
                            <button
                                onClick={() => { setLocale('en'); setLangOpen(false) }}
                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors duration-150 ${locale === 'en' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                                <span className="text-base">🇬🇧</span>
                                English
                            </button>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="w-px h-6 bg-slate-200" />

                {/* User Info */}
                <div className="flex items-center gap-x-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                        <User className="h-4 w-4" />
                    </div>
                    <span className="hidden lg:block text-sm font-medium text-slate-700 max-w-[180px] truncate">
                        {profile?.full_name || user?.email}
                    </span>
                </div>

                {/* Logout */}
                <button
                    type="button"
                    className="rounded-lg p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                    onClick={() => signOut()}
                    title={t('signOut')}
                >
                    <LogOut className="h-5 w-5" />
                </button>
            </div>
        </div>
    )
}
