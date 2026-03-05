"use client"

import { Header } from '@/components/layout/Header'
import { InventoryList } from '@/components/inventory/InventoryList'
import { InventoryForm } from '@/components/inventory/InventoryForm'
import { MenuRecommender } from '@/components/inventory/MenuRecommender'

export default function InventoryPage() {
    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
            <div className="layout-container flex h-full grow flex-col">
                <Header />

                <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
                    {/* Breadcrumbs & Title Section */}
                    <div className="flex flex-col gap-1 mb-8">
                        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                            <a className="hover:text-primary" href="/">홈</a>
                            <span className="material-symbols-outlined text-xs">chevron_right</span>
                            <span className="text-slate-900 dark:text-slate-100 font-medium">냉장고 관리</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-extrabold tracking-tight">우리아이 냉장고 🧊</h1>
                                <p className="text-slate-500 mt-1">이유식 재료의 유통기한과 상태를 관리하세요.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Left Column: Inventory List */}
                        <div className="lg:col-span-8 flex flex-col gap-6">
                            <InventoryList />
                        </div>

                        {/* Right Column: Add Form + Recommender */}
                        <div className="lg:col-span-4 flex flex-col gap-6">
                            <InventoryForm />
                            <MenuRecommender />
                        </div>
                    </div>
                </main>
                <footer className="mt-12 py-8 border-t border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-slate-400 text-sm">© 2026 맘마로그(MammaLog) - 스마트한 유아식 기록</p>
                </footer>
            </div>
        </div>
    )
}
