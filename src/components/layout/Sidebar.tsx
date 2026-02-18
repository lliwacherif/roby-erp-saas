import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { LucideIcon } from 'lucide-react'
import robyLogo from '@/assets/Roby Logo.png'

export interface NavItem {
    name: string
    href: string
    icon: LucideIcon
}

export function Sidebar({
    navigation,
    logoUrl,
    brandName = 'ROBY',
}: {
    navigation: NavItem[]
    logoUrl?: string | null
    brandName?: string
}) {
    const location = useLocation()

    return (
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-slate-900 px-5 pb-4">
            {/* Logo */}
            <div className="flex h-16 shrink-0 items-center gap-3 px-1">
                <img
                    src={logoUrl || robyLogo}
                    alt={brandName}
                    className="h-9 w-9 object-contain rounded-md bg-white/5 p-0.5"
                    onError={(e) => {
                        const target = e.currentTarget
                        if (target.src !== robyLogo) target.src = robyLogo
                    }}
                />
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent tracking-tight truncate">
                    {brandName}
                </span>
            </div>

            {/* Navigation */}
            <nav className="flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-1">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/')
                        return (
                            <li key={item.name}>
                                <Link
                                    to={item.href}
                                    className={clsx(
                                        'group flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                                        isActive
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    )}
                                >
                                    <item.icon
                                        className={clsx(
                                            'h-5 w-5 shrink-0 transition-colors duration-200',
                                            isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                                        )}
                                    />
                                    {item.name}
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            </nav>

            {/* Branding Footer */}
            <div className="border-t border-slate-700/50 pt-4 pb-2 px-1">
                <p className="text-xs font-semibold text-slate-400">ROBY ERP</p>
                <p className="text-[10px] text-slate-600 mt-0.5">CherifCorp Technologies ©2026</p>
            </div>
        </div>
    )
}
