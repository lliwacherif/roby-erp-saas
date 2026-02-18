import { Outlet } from 'react-router-dom'
import { Sidebar, NavItem } from './Sidebar'
import { Topbar } from './Topbar'
import { Building } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export default function RootLayout() {
    const { t } = useI18n()

    const navigation: NavItem[] = [
        { name: t('tenants'), href: '/root/tenants', icon: Building },
    ]

    return (
        <>
            <div>
                <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
                    <Sidebar navigation={navigation} brandName="ROBY" />
                </div>

                <div className="lg:pl-72">
                    <Topbar showTenantSwitcher={false} />

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
