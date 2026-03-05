"use client"

import { Header } from '@/components/layout/Header'
import { InventoryList } from '@/components/inventory/InventoryList'
import { InventoryForm } from '@/components/inventory/InventoryForm'
import { MenuRecommender } from '@/components/inventory/MenuRecommender'
import { ShoppingWidget } from '@/components/shopping/ShoppingWidget'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { useEffect, useState } from 'react'
import { PlanCell } from '@/types/database.types'
import { format, addDays, startOfWeek } from 'date-fns'

export default function InventoryPage() {
    const { user, currentBaby, inventories } = useAppStore()
    const [localGrid, setLocalGrid] = useState<Record<string, PlanCell>>({})
    const [isShoppingOpen, setIsShoppingOpen] = useState(false)

    // 식단 기록(meal_logs)을 가져와 ShoppingWidget용 localGrid를 만듧니다.
    useEffect(() => {
        if (!user || !currentBaby) return

        const fetchMealLogs = async () => {
            const today = new Date()
            const mon = startOfWeek(today, { weekStartsOn: 1 })
            const startStr = format(mon, 'yyyy-MM-dd')
            // 현재 주부터 다음 주까지 충분히 가져옴 (7일치 위젯 옵션 지원을 위해 14일 가져옴)
            const endStr = format(addDays(mon, 14), 'yyyy-MM-dd')

            const { data, error } = await supabase
                .from('meal_logs')
                .select('*')
                .eq('user_id', user.id)
                .eq('baby_id', currentBaby.id)
                .gte('date', startStr)
                .lte('date', endStr)

            if (!error && data) {
                const newGrid: Record<string, PlanCell> = {}
                data.forEach(log => {
                    const key = `${log.date}_${log.meal_type}`
                    const dishes = log.meal_items?.map((item: any) => item.name) || []
                    const ingredients = log.meal_items?.flatMap((item: any) => item.ingredients || []).join(', ') || ''

                    newGrid[key] = {
                        id: log.id,
                        dishes: dishes.length > 0 ? dishes : [''],
                        ingredients
                    }
                })
                setLocalGrid(newGrid)
            }
        }
        fetchMealLogs()
    }, [user, currentBaby])

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
            <div className="layout-container flex h-full grow flex-col">
                <Header />

                <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 md:px-6 py-8">
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

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative items-start">
                        {/* Left/Middle Column: Inventory List & Forms */}
                        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                                {/* Inventory List takes 2/3 space on huge screens */}
                                <div className="xl:col-span-2 flex flex-col gap-6">
                                    <InventoryList />
                                </div>
                                {/* Form and Recommender take 1/3 space on huge screens */}
                                <div className="xl:col-span-1 flex flex-col gap-6">
                                    <InventoryForm />
                                    <MenuRecommender />
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Shopping List Widget (Desktop Only) */}
                        <div className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-6">
                            <ShoppingWidget
                                inventories={inventories}
                                localGrid={localGrid}
                                layout="sidebar"
                            />
                        </div>
                    </div>
                </main>

                {/* Mobile Shopping List FAB */}
                <button
                    onClick={() => setIsShoppingOpen(true)}
                    className="lg:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold px-4 py-3.5 rounded-2xl shadow-xl shadow-slate-900/20 dark:shadow-white/20 hover:brightness-105 active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined text-xl">shopping_cart</span>
                    장보기
                </button>

                {/* Mobile Shopping List Drawer */}
                {isShoppingOpen && (
                    <>
                        <div
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
                            onClick={() => setIsShoppingOpen(false)}
                        />
                        <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl z-50 lg:hidden flex flex-col pt-10">
                            {/* Drawer Close Button */}
                            <div className="absolute top-4 right-4 z-50">
                                <button
                                    onClick={() => setIsShoppingOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <ShoppingWidget
                                inventories={inventories}
                                localGrid={localGrid}
                                layout="inline"
                                className="h-full border-0 shadow-none border-t rounded-t-none"
                            />
                        </div>
                    </>
                )}

                <footer className="mt-12 py-8 border-t border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-slate-400 text-sm">© 2026 맘마로그(MammaLog) - 스마트한 유아식 기록</p>
                </footer>
            </div>
        </div>
    )
}
