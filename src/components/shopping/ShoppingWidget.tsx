import { useState, useMemo } from 'react'
import { format, addDays } from 'date-fns'
import { Inventory } from '@/types/database.types'
import { smartExtractIngredients } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'

export type ShoppingItem = {
    name: string
    count: number
    inFridge: boolean
    isOwnedButLow: boolean
}

// PlanCell type minimal definition matching planner needs for calculating lists locally
interface PlanCellData {
    items: { name: string; satisfaction: number; ingredients: string[] }[]
}

type ShoppingWidgetProps = {
    inventories: Inventory[]
    // If localGrid is provided, the widget calculates shopping list from it (used in Planner).
    // If localGrid is omitted, the widget could potentially fetch from DB or store (future expansion),
    // but right now we'll require passing a computed list or computing it via props.
    // For maximum reusability, we can pass the grid and let the widget calculate, 
    // or pass raw items. Let's accept localGrid for accurate live view.
    localGrid: Record<string, PlanCellData>
    layout?: 'inline' | 'sidebar'
    className?: string
}

export function ShoppingWidget({ inventories, localGrid, layout = 'inline', className = '' }: ShoppingWidgetProps) {
    const { user, setInventories } = useAppStore()
    const [periodDays, setPeriodDays] = useState<3 | 7>(7)
    const [isUpdating, setIsUpdating] = useState<string | null>(null)

    // Pre-compute sets for fast lookup
    const { fridgeSet, lowStockSet, knownIngNames } = useMemo(() => {
        const fs = new Set<string>()
        const ls = new Set<string>()
        const names: string[] = []
        inventories.forEach(inv => {
            const rawName = inv.ingredient_name.split(' (')[0].trim()
            fs.add(rawName)
            if (inv.stock_status === 'low') {
                ls.add(rawName)
            }
            names.push(inv.ingredient_name)
        })
        return { fridgeSet: fs, lowStockSet: ls, knownIngNames: names }
    }, [inventories])

    // Compute shopping list dynamically based on the selected period
    const shoppingList: ShoppingItem[] = useMemo(() => {
        const needed = new Map<string, number>()
        const today = new Date()
        const todayStr = format(today, 'yyyy-MM-dd')
        const endDateStr = format(addDays(today, periodDays - 1), 'yyyy-MM-dd')

        Object.entries(localGrid).forEach(([key, cell]) => {
            const underscoreIdx = key.indexOf('_')
            const dateStr = key.slice(0, underscoreIdx)

            // Only include items within the selected period (today to endDate inclusive)
            if (dateStr < todayStr || dateStr > endDateStr) return

            const validItems = cell.items?.filter(d => d.name.trim()) || []
            if (!validItems.length) return

            const ings = validItems.flatMap(d => (d.ingredients && d.ingredients.length > 0)
                ? d.ingredients
                : smartExtractIngredients(d.name.trim(), knownIngNames))

            ings.forEach(ing => needed.set(ing, (needed.get(ing) ?? 0) + 1))
        })

        const result: ShoppingItem[] = []
        needed.forEach((count, name) => {
            const inFridge = fridgeSet.has(name)
            const isOwnedButLow = lowStockSet.has(name)
            result.push({ name, count, inFridge, isOwnedButLow })
        })

        // Sort: missing items first, then low stock, then sufficient
        return result.sort((a, b) => {
            if (a.inFridge !== b.inFridge) return Number(a.inFridge) - Number(b.inFridge)
            if (a.isOwnedButLow !== b.isOwnedButLow) return Number(b.isOwnedButLow) - Number(a.isOwnedButLow)
            return b.count - a.count
        })
    }, [localGrid, fridgeSet, lowStockSet, knownIngNames, periodDays])

    const missingItems = shoppingList.filter(i => !i.inFridge)
    const lowStockItems = shoppingList.filter(i => i.isOwnedButLow)
    const sufficientItems = shoppingList.filter(i => i.inFridge && !i.isOwnedButLow)

    const copyToClipboard = () => {
        const textToBuy = [...missingItems, ...lowStockItems].map(i => `• ${i.name} (${i.count}회)`).join('\n')
        navigator.clipboard.writeText(`📋 장보기 목록 (${periodDays}일치)\n${textToBuy}`)
    }

    return (
        <div className={`bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col ${className}`}>
            <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-500">shopping_cart</span>
                    장보기 목록
                </h2>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button
                        onClick={() => setPeriodDays(3)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${periodDays === 3 ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                    >
                        3일치
                    </button>
                    <button
                        onClick={() => setPeriodDays(7)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${periodDays === 7 ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                    >
                        7일치
                    </button>
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto ${layout === 'sidebar' ? 'max-h-[calc(100vh-250px)]' : 'max-h-96 pr-2'} space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700`}>
                {/* Missing Items */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">새로 사야 할 재료 🛒</h3>
                    {missingItems.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">다 있어요! 장볼 게 없네요 ✨</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {missingItems.map(item => (
                                <div key={item.name} className="flex items-center gap-2 p-2.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl transition-all">
                                    <span className="material-symbols-outlined text-sm text-purple-500">shopping_bag</span>
                                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                        <span className="text-sm font-semibold text-purple-700 dark:text-purple-400 truncate">{item.name}</span>
                                    </div>
                                    <span className="text-xs text-purple-500/80 font-medium mr-1">{item.count}회</span>

                                    <button
                                        onClick={async () => {
                                            if (!user) return
                                            setIsUpdating(item.name)
                                            const existing = inventories.find(i => i.ingredient_name.split(' (')[0].trim() === item.name)
                                            if (!existing) {
                                                const { data, error } = await supabase.from('inventory').insert({
                                                    user_id: user.id,
                                                    ingredient_name: item.name,
                                                    expiry_date: null,
                                                    stock_status: 'enough'
                                                }).select().single()

                                                if (!error && data) {
                                                    setInventories([data, ...inventories])
                                                }
                                            }
                                            setIsUpdating(null)
                                        }}
                                        disabled={isUpdating === item.name}
                                        className="flex items-center gap-1 text-[11px] bg-purple-100 dark:bg-purple-800/50 hover:bg-purple-200 dark:hover:bg-purple-700 text-purple-700 dark:text-purple-300 font-bold px-2 py-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                                    >
                                        {isUpdating === item.name ? (
                                            <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                        ) : (
                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                        )}
                                        이미 보유
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Low Stock Items */}
                {lowStockItems.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                            보충이 필요한 재료 (모자람) <span className="material-symbols-outlined text-[14px]">shopping_basket</span>
                        </h3>
                        <div className="flex flex-col gap-2">
                            {lowStockItems.map(item => (
                                <div key={item.name} className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl transition-all">
                                    <span className="material-symbols-outlined text-sm text-amber-500">info</span>
                                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400 truncate">{item.name}</span>
                                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/30 text-amber-600 dark:text-amber-400 font-bold rounded-md">재고 부족</span>
                                    </div>
                                    <span className="text-xs text-amber-500/80 font-medium mr-1">{item.count}회</span>

                                    <button
                                        onClick={async () => {
                                            if (!user) return
                                            setIsUpdating(item.name)
                                            const existing = inventories.find(i => i.ingredient_name.split(' (')[0].trim() === item.name)
                                            if (existing) {
                                                const { error } = await supabase
                                                    .from('inventory')
                                                    .update({ stock_status: 'enough' })
                                                    .eq('id', existing.id)

                                                if (!error) {
                                                    setInventories(inventories.map(inv => inv.id === existing.id ? { ...inv, stock_status: 'enough' } : inv))
                                                }
                                            }
                                            setIsUpdating(null)
                                        }}
                                        disabled={isUpdating === item.name}
                                        className="flex items-center gap-1 text-[11px] bg-amber-100 dark:bg-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-700 text-amber-700 dark:text-amber-300 font-bold px-2 py-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                                    >
                                        {isUpdating === item.name ? (
                                            <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                        ) : (
                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                        )}
                                        충분함
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Sufficient Items */}
                {sufficientItems.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                            냉장고에 있는 재료 <span className="material-symbols-outlined text-[14px]">kitchen</span>
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {sufficientItems.map(item => (
                                <div key={item.name} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-500 px-3 py-1 text-xs font-medium rounded-lg flex items-center gap-1 opacity-70 border border-emerald-100 dark:border-emerald-800">
                                    {item.name} <span className="opacity-60 text-[10px]">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <button
                onClick={copyToClipboard}
                disabled={missingItems.length === 0 && lowStockItems.length === 0}
                className="w-full mt-4 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
                <span className="material-symbols-outlined text-base">content_copy</span>
                {periodDays}일치 장보기 목록 복사
            </button>
        </div>
    )
}
