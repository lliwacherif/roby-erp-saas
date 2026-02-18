import { useState } from 'react'
import ArticlesTab from './ArticlesTab'
import FamillesTab from './FamillesTab'
import CategoriesTab from './CategoriesTab'
import { clsx } from 'clsx'
import { Package, Folder, Tag } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export default function ArticlePage() {
    const [activeTab, setActiveTab] = useState<'articles' | 'familles' | 'categories'>('articles')
    const { t } = useI18n()

    const tabs = [
        { key: 'articles' as const, label: t('articles'), icon: Package },
        { key: 'familles' as const, label: t('familles'), icon: Folder },
        { key: 'categories' as const, label: t('categories'), icon: Tag },
    ]

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">{t('articleManagement')}</h1>

            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={clsx(
                                'whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium flex items-center gap-2 transition-all duration-200',
                                activeTab === tab.key
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                            )}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div>
                {activeTab === 'articles' && <ArticlesTab />}
                {activeTab === 'familles' && <FamillesTab />}
                {activeTab === 'categories' && <CategoriesTab />}
            </div>
        </div>
    )
}
