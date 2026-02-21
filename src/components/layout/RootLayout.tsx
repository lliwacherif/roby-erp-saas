import { Outlet } from 'react-router-dom'
import { Sidebar, NavItem } from './Sidebar'
import { Topbar } from './Topbar'
import { Building } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useState } from 'react'
import { clsx } from 'clsx'

export default function RootLayout() {
    const { t } = useI18n()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const navigation: NavItem[] = [
        { name: t('tenants'), href: '/root/tenants', icon: Building },
    ]

    return (
        <>
            <div>
                {/* Mobile Sidebar Backdrop */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm lg:hidden animate-in fade-in"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Mobile Sidebar Drawer */}
                <div className={clsx(
                    "fixed inset-y-0 left-0 z-50 w-72 transform lg:hidden transition-transform duration-300 ease-in-out shadow-2xl",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}>
                    <div className="flex h-full flex-col">
                        <Sidebar navigation={navigation} brandName="ROBY" onClose={() => setSidebarOpen(false)} />
                    </div>
                </div>

                <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
                    <Sidebar navigation={navigation} brandName="ROBY" />
                </div>

                <div className="lg:pl-72">
                    <Topbar showTenantSwitcher={false} onOpenSidebar={() => setSidebarOpen(true)} />

                    <main className="py-6 sm:py-8">
                        <div className="px-4 sm:px-6 lg:px-8">
                            <Outlet />
                        </div>
                    </main>
                </div>
            </div>
        </>
    )
}
