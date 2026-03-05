"use client"

import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { getMealLogs } from '@/lib/api'
import { Header } from '@/components/layout/Header'
import { AuthModal } from '@/components/auth/AuthModal'
import { format, addDays, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'

const MEAL_TYPES = ['아침', '간식1', '점심', '간식2', '저녁']
const MEAL_EMOJI: Record<string, string> = {
    '아침': '🌅', '간식1': '🍪', '점심': '🍱', '간식2': '🧃', '저녁': '🌙'
}

type PlanCell = { dish_name: string; ingredients: string }

function buildWeekDates(anchor: Date): string[] {
    const mon = startOfWeek(anchor, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => format(addDays(mon, i), 'yyyy-MM-dd'))
}

export default function PlannerPage() {
    const { user, inventories, setInventories } = useAppStore()
    const [weekAnchor, setWeekAnchor] = useState(new Date())
    const weekDates = useMemo(() => buildWeekDates(weekAnchor), [weekAnchor])

    // grid state: key = `${date}_${mealType}`
    const [grid, setGrid] = useState<Record<string, PlanCell>>({})

    // 냉장고 데이터 직접 fetch (냉장고 페이지 미방문 시에도 동작)
    useEffect(() => {
        if (!user || inventories.length > 0) return
        supabase.from('inventory').select('*').eq('user_id', user.id)
            .then(({ data }) => { if (data) setInventories(data) })
    }, [user, inventories.length, setInventories])

    // 주간이 바뀔 때마다 해당 기간의 실제 식단 기록을 가져와 그리드에 자동 채우기
    const weekStart = weekDates[0]
    const weekEnd = weekDates[6]
    useEffect(() => {
        if (!user) return
        getMealLogs(user.id, weekStart, weekEnd).then(logs => {
            setGrid(prev => {
                const next = { ...prev }
                for (const log of logs) {
                    const key = `${log.date}_${log.meal_type}`
                    // 수동으로 입력된 셀은 유지, 비어있는 셀만 자동 채우기
                    if (!next[key]?.dish_name) {
                        const dishName = (log.meal_items ?? [])
                            .map(i => i.name).filter(Boolean).join(', ') || log.meal_name || ''
                        const ingredients = (log.meal_items ?? [])
                            .flatMap(i => i.ingredients).join(', ')
                        if (dishName) next[key] = { dish_name: dishName, ingredients }
                    }
                }
                return next
            })
        }).catch(() => { })
    }, [user, weekStart, weekEnd])

    // 과거 기록으로 자동완성 후보
    const [pastMenus, setPastMenus] = useState<string[]>([])
    useEffect(() => {
        if (!user) return
        getMealLogs(user.id,
            format(addDays(new Date(), -90), 'yyyy-MM-dd'),
            format(new Date(), 'yyyy-MM-dd')
        ).then(logs => {
            const names = new Set<string>()
            for (const l of logs) {
                for (const item of l.meal_items ?? []) {
                    if (item.name.trim()) names.add(item.name.trim())
                }
            }
            setPastMenus([...names])
        }).catch(() => { })
    }, [user])


    const fridgeSet = useMemo(
        () => new Set(inventories.map(i => i.ingredient_name.split(' (')[0].trim())),
        [inventories]
    )

    const updateCell = (date: string, mealType: string, patch: Partial<PlanCell>) => {
        const key = `${date}_${mealType}`
        setGrid(prev => ({ ...prev, [key]: { ...({ dish_name: '', ingredients: '' } as PlanCell), ...(prev[key] ?? {}), ...patch } }))
    }

    // 장보기 목록 계산
    const shoppingList = useMemo(() => {
        const needed = new Map<string, number>()
        Object.values(grid).forEach(cell => {
            if (!cell.dish_name.trim()) return
            const ings = cell.ingredients
                ? cell.ingredients.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
                : cell.dish_name.trim().split(/\s+/).filter(Boolean)
            ings.forEach(ing => needed.set(ing, (needed.get(ing) ?? 0) + 1))
        })
        const result: { name: string; count: number; inFridge: boolean }[] = []
        needed.forEach((count, name) => {
            result.push({ name, count, inFridge: fridgeSet.has(name) })
        })
        return result.sort((a, b) => Number(a.inFridge) - Number(b.inFridge))
    }, [grid, fridgeSet])

    const missingItems = shoppingList.filter(i => !i.inFridge)

    const copyToClipboard = () => {
        const text = missingItems.map(i => `• ${i.name} (${i.count}회)`).join('\n')
        navigator.clipboard.writeText(`📋 장보기 목록\n${text}`)
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <AuthModal />
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-8">
                {/* Title */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight">주간 식단 계획 📋</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">한 주 식단을 미리 계획하고 장볼 재료를 확인하세요</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2 shadow-sm">
                        <button onClick={() => setWeekAnchor(d => addDays(d, -7))} className="p-1 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <span className="text-sm font-bold min-w-[160px] text-center">
                            {format(new Date(weekDates[0]), 'M월 d일', { locale: ko })} – {format(new Date(weekDates[6]), 'M월 d일 (EEE)', { locale: ko })}
                        </span>
                        <button onClick={() => setWeekAnchor(d => addDays(d, 7))} className="p-1 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ── 주간 그리드 ── */}
                    <div className="lg:col-span-2 overflow-x-auto">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                            {/* 날짜 헤더 */}
                            <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-100 dark:border-slate-800">
                                <div className="p-3 text-xs font-bold text-slate-400 flex items-center justify-center">끼니</div>
                                {weekDates.map(d => {
                                    const isToday = d === format(new Date(), 'yyyy-MM-dd')
                                    return (
                                        <div key={d} className={`p-3 text-center border-l border-slate-100 dark:border-slate-800 ${isToday ? 'bg-primary/10' : ''}`}>
                                            <p className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-slate-500'}`}>
                                                {format(new Date(d), 'EEE', { locale: ko })}
                                            </p>
                                            <p className={`text-sm font-black ${isToday ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {format(new Date(d), 'd')}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* 끼니별 행 */}
                            {MEAL_TYPES.map(mealType => (
                                <div key={mealType} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-50 dark:border-slate-800 last:border-0">
                                    <div className="p-2 flex flex-col items-center justify-center gap-0.5 bg-slate-50/50 dark:bg-slate-800/30">
                                        <span className="text-base">{MEAL_EMOJI[mealType]}</span>
                                        <span className="text-[10px] font-bold text-slate-400">{mealType}</span>
                                    </div>
                                    {weekDates.map(d => {
                                        const key = `${d}_${mealType}`
                                        const cell = grid[key] ?? { dish_name: '', ingredients: '' }
                                        return (
                                            <div key={key} className="border-l border-slate-100 dark:border-slate-800 p-1.5 min-h-[70px]">
                                                <input
                                                    list={`past-menus-${key}`}
                                                    value={cell.dish_name}
                                                    onChange={e => updateCell(d, mealType, { dish_name: e.target.value })}
                                                    onBlur={e => {
                                                        // 이름 입력 후 재료 자동 설정
                                                        const name = e.target.value.trim()
                                                        if (name && !cell.ingredients) {
                                                            updateCell(d, mealType, { ingredients: name.split(/\s+/).join(', ') })
                                                        }
                                                    }}
                                                    placeholder="메뉴명"
                                                    className="w-full text-[11px] font-bold bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-300 mb-1"
                                                />
                                                <datalist id={`past-menus-${key}`}>
                                                    {pastMenus.map(m => <option key={m} value={m} />)}
                                                </datalist>
                                                <input
                                                    value={cell.ingredients}
                                                    onChange={e => updateCell(d, mealType, { ingredients: e.target.value })}
                                                    placeholder="재료 (쉼표 구분)"
                                                    className="w-full text-[10px] bg-transparent border-none outline-none text-slate-400 placeholder:text-slate-200"
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── 장보기 목록 사이드바 ── */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="font-bold text-lg flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">shopping_cart</span>
                                    장보기 목록
                                </h2>
                                {missingItems.length > 0 && (
                                    <button
                                        onClick={copyToClipboard}
                                        className="text-xs text-primary font-bold flex items-center gap-1 hover:underline"
                                    >
                                        <span className="material-symbols-outlined text-sm">content_copy</span>
                                        복사
                                    </button>
                                )}
                            </div>

                            {shoppingList.length === 0 ? (
                                <div className="py-8 text-center text-slate-400">
                                    <span className="material-symbols-outlined text-4xl mb-2 block">edit_calendar</span>
                                    <p className="text-sm">식단을 입력하면<br />장보기 목록이 생성됩니다</p>
                                </div>
                            ) : (
                                <>
                                    {/* 필요한 것 */}
                                    {missingItems.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">구매 필요 ({missingItems.length})</p>
                                            <div className="flex flex-col gap-1.5">
                                                {missingItems.map(item => (
                                                    <div key={item.name} className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl">
                                                        <span className="material-symbols-outlined text-amber-500 text-sm">shopping_bag</span>
                                                        <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                                                        <span className="text-xs text-slate-400">{item.count}회</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* 냉장고에 있는 것 */}
                                    {shoppingList.filter(i => i.inFridge).length > 0 && (
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">냉장고 보유 ✅</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {shoppingList.filter(i => i.inFridge).map(item => (
                                                    <span key={item.name} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg font-medium">
                                                        {item.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* 요약 통계 */}
                        {shoppingList.length > 0 && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 text-center shadow-sm">
                                    <p className="text-2xl font-black text-amber-500">{missingItems.length}</p>
                                    <p className="text-xs text-slate-400 font-bold mt-0.5">구매 필요</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 text-center shadow-sm">
                                    <p className="text-2xl font-black text-primary">{shoppingList.filter(i => i.inFridge).length}</p>
                                    <p className="text-xs text-slate-400 font-bold mt-0.5">이미 보유</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <footer className="py-8 border-t border-slate-200 dark:border-slate-800 text-center">
                <p className="text-slate-400 text-sm">© 2026 맘마로그(MammaLog) — 스마트한 유아식 기록</p>
            </footer>
        </div>
    )
}
