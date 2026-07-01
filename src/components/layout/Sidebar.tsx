import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { LucideIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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
    onClose,
    collapsed = false,
    onToggleCollapse,
}: {
    navigation: NavItem[]
    logoUrl?: string | null
    brandName?: string
    onClose?: () => void
    collapsed?: boolean
    onToggleCollapse?: () => void
}) {
    const location = useLocation()

    return (
        <div
            className={clsx(
                'flex grow flex-col gap-y-5 overflow-y-auto bg-slate-900 pb-4 transition-all duration-300',
                collapsed ? 'px-3' : 'px-5'
            )}
        >
            {/* Logo */}
            <div
                className={clsx(
                    'relative flex shrink-0 items-center',
                    collapsed ? 'h-24 flex-col justify-center gap-2 px-0' : 'h-16 justify-between gap-3 px-1'
                )}
            >
                <div className={clsx('flex min-w-0 items-center gap-3', collapsed && 'justify-center')}>
                    <img
                        src={logoUrl || robyLogo}
                        alt={brandName}
                        className={clsx(
                            'shrink-0 object-contain rounded-md bg-white/5 p-0.5',
                            collapsed ? 'h-8 w-8' : 'h-9 w-9'
                        )}
                        onError={(e) => {
                            const target = e.currentTarget
                            if (target.src !== robyLogo) target.src = robyLogo
                        }}
                    />
                    {!collapsed && (
                        <span className="truncate bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-xl font-bold tracking-tight text-transparent">
                            {brandName}
                        </span>
                    )}
                </div>
                {onToggleCollapse && (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        className={clsx(
                            'hidden shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-800 hover:text-white lg:flex',
                            collapsed ? 'h-8 w-8 border border-slate-700/70 bg-slate-800/60' : 'h-9 w-9'
                        )}
                        title={collapsed ? 'Ouvrir le menu' : 'Reduire le menu'}
                        aria-label={collapsed ? 'Ouvrir le menu' : 'Reduire le menu'}
                    >
                        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                    </button>
                )}
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
                                    onClick={onClose}
                                    title={collapsed ? item.name : undefined}
                                    className={clsx(
                                        'group flex items-center rounded-lg text-sm font-medium transition-all duration-200',
                                        collapsed ? 'justify-center px-2 py-3' : 'gap-x-3 px-3 py-2.5',
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
                                    {!collapsed && <span className="truncate">{item.name}</span>}
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            </nav>

            {/* Branding Footer */}
            <div className={clsx('border-t border-slate-700/50 pt-4 pb-2 px-1', collapsed && 'text-center')}>
                {collapsed ? (
                    <p className="text-[10px] font-bold text-slate-500">ROBY</p>
                ) : (
                    <>
                        <p className="text-xs font-semibold text-slate-400">ROBY ERP</p>
                        <p className="text-[10px] text-slate-600 mt-0.5">CherifCorp Technologies (c) 2026</p>
                    </>
                )}
            </div>
        </div>
    )
}
