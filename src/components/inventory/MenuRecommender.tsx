"use client"

import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'

type RecommendedMenu = {
    name: string
    ingredients: string[]
    have: string[]      // 냉장고에 있는 재료
    missing: string[]   // 없는 재료
    matchPct: number    // 보유 비율
}

export function MenuRecommender() {
    const { inventories, logs } = useAppStore()

    const fridgeItems = useMemo(
        () => new Set(inventories.map(i => i.ingredient_name.split(' (')[0].trim())),
        [inventories]
    )

    const recommendations = useMemo<RecommendedMenu[]>(() => {
        if (inventories.length === 0 || logs.length === 0) return []

        // 과거 meal_items에서 메뉴명 → 재료 목록 수집
        const menuMap = new Map<string, Map<string, number>>()
        for (const log of logs) {
            for (const item of log.meal_items ?? []) {
                if (!item.name.trim() || item.ingredients.length === 0) continue
                const key = item.name.trim()
                if (!menuMap.has(key)) menuMap.set(key, new Map())
                for (const ing of item.ingredients) {
                    const t = ing.trim()
                    if (t) menuMap.get(key)!.set(t, (menuMap.get(key)!.get(t) ?? 0) + 1)
                }
            }
        }

        const results: RecommendedMenu[] = []
        menuMap.forEach((ingMap, name) => {
            const ingredients = [...ingMap.keys()]
            if (ingredients.length === 0) return
            const have = ingredients.filter(ing => fridgeItems.has(ing))
            const missing = ingredients.filter(ing => !fridgeItems.has(ing))
            const matchPct = Math.round((have.length / ingredients.length) * 100)
            // 냉장고 재료가 하나라도 있는 메뉴만 표시
            if (have.length > 0) {
                results.push({ name, ingredients, have, missing, matchPct })
            }
        })

        // 보유 비율 높은 순 정렬
        return results.sort((a, b) => b.matchPct - a.matchPct).slice(0, 8)
    }, [inventories, logs, fridgeItems])

    if (inventories.length === 0) return null

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
            <h2 className="font-bold text-lg flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary">lightbulb</span>
                메뉴 추천
            </h2>
            <p className="text-xs text-slate-400 mb-5">냉장고 재료 + 과거 기록 기반</p>

            {recommendations.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2 block">restaurant_menu</span>
                    <p className="text-sm">
                        {logs.length === 0
                            ? '식단 기록이 쌓이면 추천이 나타나요!'
                            : '현재 냉장고 재료로 만들 수 있는 이전 메뉴가 없어요.'}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {recommendations.map((menu) => (
                        <div
                            key={menu.name}
                            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">{menu.name}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${menu.matchPct === 100
                                        ? 'bg-primary/20 text-primary'
                                        : menu.matchPct >= 50
                                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                                            : 'bg-slate-200 text-slate-500 dark:bg-slate-700'
                                    }`}>
                                    {menu.matchPct}% 보유
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {menu.have.map(ing => (
                                    <span key={ing} className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                                        {ing}
                                    </span>
                                ))}
                                {menu.missing.map(ing => (
                                    <span key={ing} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-400 font-medium line-through">
                                        {ing}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
