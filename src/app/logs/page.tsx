"use client"

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { MealLog } from '@/types/database.types'
import { Header } from '@/components/layout/Header'
import { AuthModal } from '@/components/auth/AuthModal'
import { format, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'



interface StatEntry { name: string; count: number; avgSat: number }

function computeStats(logs: MealLog[]) {
    // --- Best/Worst meals (per dish item) ---
    const mealMap: Record<string, { totalSat: number; count: number }> = {}
    for (const log of logs) {
        const items = log.meal_items && log.meal_items.length > 0
            ? log.meal_items
            : [{ name: log.meal_name?.trim() || '(이름 없음)', ingredients: [], satisfaction: log.satisfaction ?? 3 }]
        for (const item of items) {
            const key = item.name || '(이름 없음)'
            if (!mealMap[key]) mealMap[key] = { totalSat: 0, count: 0 }
            mealMap[key].totalSat += item.satisfaction
            mealMap[key].count++
        }
    }
    const mealStats: StatEntry[] = Object.entries(mealMap).map(([name, v]) => ({
        name,
        count: v.count,
        avgSat: v.totalSat / v.count,
    }))
    const sortedByAvgSat = [...mealStats].sort((a, b) => b.avgSat - a.avgSat)
    const bestMeals = sortedByAvgSat.slice(0, 5)
    const worstMeals = [...mealStats].sort((a, b) => a.avgSat - b.avgSat).slice(0, 5)

    // --- Top ingredients (from meal_items OR note_text) ---
    const ingMap: Record<string, number> = {}
    for (const log of logs) {
        if (log.meal_items && log.meal_items.length > 0) {
            for (const item of log.meal_items) {
                for (const ing of item.ingredients) {
                    if (ing.trim()) ingMap[ing.trim()] = (ingMap[ing.trim()] ?? 0) + 1
                }
            }
        } else if (log.note_text) {
            const parts = log.note_text.split(',').map(s => s.trim()).filter(Boolean)
            for (const p of parts) {
                ingMap[p] = (ingMap[p] ?? 0) + 1
            }
        }
    }
    const topIngredients: StatEntry[] = Object.entries(ingMap)
        .map(([name, count]) => ({ name, count, avgSat: 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)

    return { bestMeals, worstMeals, topIngredients, total: logs.length }
}

const SAT_LABEL: Record<number, { label: string; color: string }> = {
    5: { label: '다 먹음', color: 'text-primary' },
    4: { label: '반쯤 먹음', color: 'text-blue-400' },
    2: { label: '조금 먹음', color: 'text-amber-400' },
    1: { label: '거의 안 먹음', color: 'text-red-400' },
}

function SatBar({ value }: { value: number }) {
    const pct = Math.round((value / 5) * 100)
    const color = value >= 4 ? 'bg-primary' : value >= 2.5 ? 'bg-amber-400' : 'bg-red-400'
    return (
        <div className="flex items-center gap-2 text-xs text-slate-500 w-24">
            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 font-semibold">{value.toFixed(1)}</span>
        </div>
    )
}

export default function LogsPage() {
    const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
    const [logs, setLogs] = useState<MealLog[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
    const { currentBaby } = useAppStore()

    const fetchLogs = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            setIsLoggedIn(!!authUser)
            if (!authUser) {
                return
            }

            let query = supabase
                .from('meal_logs')
                .select('*')
                .eq('user_id', authUser.id)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false })

            if (currentBaby) {
                query = query.eq('baby_id', currentBaby.id)
            }

            const { data, error: sbErr } = await query

            if (sbErr) throw sbErr

            setLogs((data ?? []) as MealLog[])
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : JSON.stringify(e)
            setError(msg)
        } finally {
            setIsLoading(false)
        }
    }, [startDate, endDate, currentBaby?.id])

    // Update preset ranges
    const setPresetValue = (days: number) => {
        setStartDate(format(subDays(new Date(), days), 'yyyy-MM-dd'))
        setEndDate(format(new Date(), 'yyyy-MM-dd'))
    }

    // Fetch on mount and when period changes
    useEffect(() => { fetchLogs() }, [fetchLogs])

    // Auto-refetch when tab becomes visible
    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === 'visible') fetchLogs() }
        document.addEventListener('visibilitychange', onVisible)
        return () => document.removeEventListener('visibilitychange', onVisible)
    }, [fetchLogs])

    const stats = computeStats(logs)

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <AuthModal />
            <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
                {/* Title + Period Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight">식단 통계</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">기간별 식단 분석 결과</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Custom Date Inputs */}
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent border-none text-xs font-bold focus:ring-0 p-1.5 text-slate-700 dark:text-slate-200"
                            />
                            <span className="text-slate-400 text-xs">~</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent border-none text-xs font-bold focus:ring-0 p-1.5 text-slate-700 dark:text-slate-200"
                            />
                        </div>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

                        <button
                            onClick={fetchLogs}
                            disabled={isLoading}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
                            title="새로고침"
                        >
                            <span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
                        </button>

                        <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                            <button
                                onClick={() => setPresetValue(7)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all"
                            >
                                7일
                            </button>
                            <button
                                onClick={() => setPresetValue(30)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all"
                            >
                                30일
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">error</span>
                        {error}
                    </div>
                )}

                {isLoggedIn === false ? (
                    <div className="text-center py-20 text-slate-400">
                        <span className="material-symbols-outlined text-5xl mb-4 block">lock</span>
                        <p className="font-semibold">로그인 후 이용 가능합니다.</p>
                    </div>
                ) : isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <span className="material-symbols-outlined text-primary text-4xl animate-spin">refresh</span>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <span className="material-symbols-outlined text-5xl mb-4 block">bar_chart</span>
                        <p className="font-semibold">이 기간의 식단 기록이 없어요.<br />먼저 식단을 기록해 보세요!</p>
                    </div>
                ) : (
                    <>
                        {/* Overview */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                            {[
                                { label: '총 기록 수', value: `${stats.total}회`, icon: 'receipt_long', color: 'bg-primary/10 text-primary' },
                                { label: '평균 섭취량', value: (() => { const sats = logs.flatMap(l => l.meal_items?.length ? l.meal_items.map(i => i.satisfaction) : [l.satisfaction ?? 3]); return (sats.reduce((a, b) => a + b, 0) / sats.length).toFixed(1) + ' / 5' })(), icon: 'sentiment_satisfied', color: 'bg-green-100 text-green-500' },
                                { label: '기록한 날', value: `${new Set(logs.map(l => l.date)).size}일`, icon: 'calendar_month', color: 'bg-blue-100 text-blue-500' },
                                {
                                    label: '분석 식재료', icon: 'grocery', color: 'bg-purple-100 text-purple-500',
                                    value: (() => {
                                        const ingSet = new Set<string>()
                                        for (const l of logs) {
                                            // meal_items 재료 우선
                                            if (l.meal_items && l.meal_items.length > 0) {
                                                for (const item of l.meal_items) {
                                                    for (const ing of item.ingredients) {
                                                        if (ing.trim()) ingSet.add(ing.trim())
                                                    }
                                                }
                                            }
                                            // note_text 보조 파싱
                                            if (l.note_text) {
                                                for (const p of l.note_text.split(',')) {
                                                    if (p.trim()) ingSet.add(p.trim())
                                                }
                                            }
                                        }
                                        return `${ingSet.size}종`
                                    })()
                                },
                            ].map(s => (
                                <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                                    <div className={`size-10 rounded-xl ${s.color} flex items-center justify-center shrink-0`}>
                                        <span className="material-symbols-outlined">{s.icon}</span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">{s.label}</p>
                                        <p className="text-xl font-black text-slate-900 dark:text-slate-100">{s.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Best Meals */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                                <h2 className="font-bold text-lg flex items-center gap-2 mb-5">
                                    <span className="material-symbols-outlined text-primary">emoji_food_beverage</span>
                                    가장 잘 먹은 메뉴
                                </h2>
                                {stats.bestMeals.length === 0 ? (
                                    <p className="text-slate-400 text-sm">데이터가 없습니다.</p>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {stats.bestMeals.map((m, idx) => (
                                            <div key={m.name} className="flex items-center gap-3">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0
                                                    ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                    {idx + 1}
                                                </span>
                                                <span className="flex-1 font-semibold text-sm truncate text-slate-900 dark:text-slate-100">{m.name}</span>
                                                <span className="text-xs text-slate-400 shrink-0">{m.count}회</span>
                                                <SatBar value={m.avgSat} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Worst Meals */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                                <h2 className="font-bold text-lg flex items-center gap-2 mb-5">
                                    <span className="material-symbols-outlined text-red-400">sentiment_dissatisfied</span>
                                    가장 안 먹은 메뉴
                                </h2>
                                {stats.worstMeals.length === 0 ? (
                                    <p className="text-slate-400 text-sm">데이터가 없습니다.</p>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {stats.worstMeals.map((m, idx) => (
                                            <div key={m.name} className="flex items-center gap-3">
                                                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500 shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <span className="flex-1 font-semibold text-sm truncate text-slate-900 dark:text-slate-100">{m.name}</span>
                                                <span className="text-xs text-slate-400 shrink-0">{m.count}회</span>
                                                <SatBar value={m.avgSat} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Top Ingredients */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm lg:col-span-2">
                                <h2 className="font-bold text-lg flex items-center gap-2 mb-5">
                                    <span className="material-symbols-outlined text-green-500">eco</span>
                                    가장 많이 먹은 재료 TOP 8
                                </h2>
                                {stats.topIngredients.length === 0 ? (
                                    <p className="text-slate-400 text-sm">재료 데이터가 없습니다. 식단 기록 시 재료를 입력해 보세요!</p>
                                ) : (
                                    <div className="flex flex-wrap gap-3">
                                        {stats.topIngredients.map((ing, idx) => {
                                            const size = idx === 0 ? 'text-base px-4 py-2' : idx < 3 ? 'text-sm px-3 py-1.5' : 'text-xs px-3 py-1'
                                            const bg = idx === 0 ? 'bg-primary text-slate-900' : idx < 3 ? 'bg-primary/20 text-primary-dark' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                            return (
                                                <div key={ing.name} className={`rounded-full font-bold flex items-center gap-1.5 ${size} ${bg}`}>
                                                    <span>{ing.name}</span>
                                                    <span className="opacity-60 text-[10px]">{ing.count}회</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Recent log list */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm lg:col-span-2">
                                <h2 className="font-bold text-lg flex items-center gap-2 mb-5">
                                    <span className="material-symbols-outlined text-blue-400">history</span>
                                    최근 기록 목록
                                </h2>
                                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                                    {logs.slice(0, 20).map(log => {
                                        const nameText = log.meal_items?.length
                                            ? log.meal_items.map(i => i.name).filter(Boolean).join(' · ')
                                            : (log.meal_name || '(이름 없음)')
                                        const overallSat = log.meal_items?.length
                                            ? log.meal_items.reduce((b, i) => i.satisfaction > b ? i.satisfaction : b, 0)
                                            : (log.satisfaction ?? 0)
                                        const sat = SAT_LABEL[overallSat] ?? { label: '?', color: 'text-slate-400' }
                                        return (
                                            <div key={log.id} className="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                                                <span className="text-xs text-slate-400 shrink-0 w-20">{format(new Date(log.date), 'M/d (EEE)', { locale: ko })}</span>
                                                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">{log.meal_type}</span>
                                                <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{nameText}</span>
                                                <span className={`text-xs font-bold shrink-0 ${sat.color}`}>{sat.label}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>

            <footer className="py-8 border-t border-slate-200 dark:border-slate-800 text-center">
                <p className="text-slate-400 text-sm">© 2026 맘마로그(MammaLog) — 스마트한 유아식 기록</p>
            </footer>
        </div>
    )
}
