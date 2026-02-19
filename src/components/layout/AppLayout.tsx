import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar, NavItem } from './Sidebar'
import { Topbar } from './Topbar'
import { Package, Warehouse, Briefcase, Receipt, Users, BarChart3, HardHat } from 'lucide-react'
import { useTenant } from '@/lib/tenant'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { applyDueRentalStarts } from '@/lib/rentalStock'
import { useEffect, useState } from 'react'

export default function AppLayout() {
    const { currentTenant, loading } = useTenant()
    const { profile } = useAuth()
    const { t } = useI18n()
    const [timedOut, setTimedOut] = useState(false)

    useEffect(() => {
        if (loading) {
            const timer = setTimeout(() => setTimedOut(true), 5000)
            return () => clearTimeout(timer)
        }
    }, [loading])

    useEffect(() => {
        if (!currentTenant) return
        applyDueRentalStarts(currentTenant.id).catch(() => {
            // Silent sync: avoid blocking UI on background stock scheduling.
        })
    }, [currentTenant])

    const navigation: NavItem[] = [
        { name: t('kpi'), href: '/app/kpi', icon: BarChart3 },
        { name: t('articles'), href: '/app/articles', icon: Package },
        { name: t('stock'), href: '/app/stock', icon: Warehouse },
        { name: t('services'), href: '/app/services', icon: Briefcase },
        { name: t('expenses'), href: '/app/depenses', icon: Receipt },
        { name: t('clients'), href: '/app/clients', icon: Users },
        { name: t('workers'), href: '/app/ouvriers', icon: HardHat },
    ]

    if (loading && !timedOut) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-500 font-medium">{t('loading')}</span>
                </div>
            </div>
        )
    }

    if (!currentTenant) {
        if (profile?.is_root) {
            return <Navigate to="/root/tenants" replace />
        }

        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center bg-white rounded-2xl shadow-lg p-10 max-w-md">
                    <div className="mx-auto h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                        <Package className="h-7 w-7 text-slate-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900">{t('noTenantTitle')}</h2>
                    <p className="text-slate-500 mt-2">{t('noTenantMsg')}</p>
                    <div className="mt-6">
                        <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors">{t('backToLogin')}</a>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div>
                <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
                    <Sidebar
                        navigation={navigation}
                        logoUrl={currentTenant.logo_url}
                        brandName={currentTenant.name}
                    />
                </div>

                <div className="lg:pl-72">
                    <Topbar showTenantSwitcher={true} />

                    <main className="py-8">
                        <div className="px-6 lg:px-8">
                            <Outlet />
                        </div>
                    </main>
                </div>
            </div>
        </>
    )
}
