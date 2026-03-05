"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { getMealLogs } from '@/lib/api'
import { Header } from '@/components/layout/Header'
import { AuthModal } from '@/components/auth/AuthModal'
import { format, addDays, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { normalizeIngredient, extractIngredients, smartExtractIngredients } from '@/lib/ingredients'

const MEAL_TYPES = ['아침', '간식1', '점심', '간식2', '저녁']
const MEAL_EMOJI: Record<string, string> = {
    '아침': '🌅', '간식1': '🍪', '점심': '🍱', '간식2': '🧃', '저녁': '🌙'
}

// 한 끼니에 여러 음식을 담을 수 있는 셀 타입
type PlanCell = {
    id?: string
    dishes: string[]      // 음식 목록 (여러 개)
    ingredients: string   // 재료 (공통)
}

function buildWeekDates(anchor: Date): string[] {
    const mon = startOfWeek(anchor, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => format(addDays(mon, i), 'yyyy-MM-dd'))
}

const AUTOSAVE_DEBOUNCE_MS = 1500

export default function PlannerPage() {
    const { user, inventories, setInventories, currentBaby } = useAppStore()
    const [weekAnchor, setWeekAnchor] = useState(new Date())
    const weekDates = useMemo(() => buildWeekDates(weekAnchor), [weekAnchor])
    const [isSaving, setIsSaving] = useState(false)
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saved' | 'error'>('idle')
    const [selectedCell, setSelectedCell] = useState<{ date: string; mealType: string } | null>(null)
    const [isShoppingOpen, setIsShoppingOpen] = useState(false)
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // grid state: key = `${date}_${mealType}`
    const [grid, setGrid] = useState<Record<string, PlanCell>>({})

    // 냉장고 데이터 직접 fetch
    useEffect(() => {
        if (!user || inventories.length > 0) return
        supabase.from('inventory').select('*').eq('user_id', user.id)
            .then(({ data }) => { if (data) setInventories(data) })
    }, [user, inventories.length, setInventories])

    const weekStart = weekDates[0]
    const weekEnd = weekDates[6]

    // DB 로드 중임을 표시하는 플래그 (자동저장 방지용)
    const isDbLoading = useRef(false)

    // DB에서 식단 기록을 불러와 그리드에 채우기
    const loadLogsIntoGrid = useCallback(async () => {
        if (!user) return
        isDbLoading.current = true
        try {
            const logs = await getMealLogs(user.id, weekStart, weekEnd)
            setGrid(prev => {
                const next = { ...prev }
                for (const log of logs) {
                    const key = `${log.date}_${log.meal_type}`
                    const dishes = (log.meal_items ?? [])
                        .map(i => i.name).filter(Boolean)
                    const ingredients = (log.meal_items ?? [])
                        .flatMap(i => i.ingredients).join(', ')

                    // DB 기록으로 항상 덮어씀 (ID 보존)
                    next[key] = { id: log.id, dishes: dishes.length ? dishes : [''], ingredients }
                }
                return next
            })
        } catch (e) {
            console.error(e)
        } finally {
            // React state update가 처리된 후 플래그 해제
            setTimeout(() => { isDbLoading.current = false }, 100)
        }
    }, [user, weekStart, weekEnd])

    useEffect(() => {
        setGrid({}) // 주간 변경 시 기존 그리드 초기화
        loadLogsIntoGrid()
    }, [loadLogsIntoGrid])

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

    const lowStockSet = useMemo(
        () => new Set(
            inventories
                .filter(i => i.stock_status === 'low')
                .map(i => normalizeIngredient(i.ingredient_name.split(' (')[0].trim()))
        ),
        [inventories]
    )

    const fridgeSet = useMemo(
        () => new Set(
            inventories
                .filter(i => i.stock_status !== 'low')
                .map(i => normalizeIngredient(i.ingredient_name.split(' (')[0].trim()))
        ),
        [inventories]
    )

    // 셀 업데이트 함수
    const updateCell = useCallback((date: string, mealType: string, patch: Partial<PlanCell>) => {
        const key = `${date}_${mealType}`
        const defaultCell: PlanCell = { dishes: [''], ingredients: '' }
        setGrid(prev => ({
            ...prev,
            [key]: {
                ...defaultCell,
                ...(prev[key] ?? {}),
                ...patch,
            }
        }))
    }, [])

    // 메뉴명 입력 시 재료 자동 추출 도우미
    const handleDishBlur = useCallback((date: string, mealType: string, dishName: string) => {
        if (!dishName.trim()) return

        const key = `${date}_${mealType}`
        const cell = grid[key] ?? { dishes: [], ingredients: '' }
        const knownIngNames = inventories.map(i => i.ingredient_name)
        const extracted = smartExtractIngredients(dishName, knownIngNames)

        if (extracted.length > 0) {
            const currentIngs = cell.ingredients
                ? cell.ingredients.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
                : []

            const combined = new Set([...currentIngs, ...extracted])
            const newIngString = Array.from(combined).join(', ')

            if (newIngString !== cell.ingredients) {
                updateCell(date, mealType, { ingredients: newIngString })
            }
        }
    }, [grid, inventories, updateCell])

    // === 자동 저장 로직 (디바운스) ===
    // 최신 saveGridToDb를 항상 참조하기 위한 ref
    const saveGridToDbRef = useRef<((g: Record<string, PlanCell>) => Promise<void>) | null>(null)

    const saveGridToDb = useCallback(async (currentGrid: Record<string, PlanCell>) => {
        if (!user || !currentBaby) return
        setIsSaving(true)
        try {
            const insertedIds: Record<string, string> = {}
            const promises: Promise<unknown>[] = []

            for (const [key, cell] of Object.entries(currentGrid)) {
                const validDishes = cell.dishes.filter(d => d.trim())
                // ID가 없으면서 내용도 없으면 건너뜀
                if (!validDishes.length && !cell.id) continue

                const underscoreIdx = key.indexOf('_')
                const date = key.slice(0, underscoreIdx)
                const mealType = key.slice(underscoreIdx + 1)

                const knownIngNames = inventories.map(i => i.ingredient_name)
                const ingredientsArray = smartExtractIngredients(cell.ingredients, knownIngNames)
                const items = validDishes.map(name => ({
                    name: name.trim(),
                    ingredients: ingredientsArray,
                    satisfaction: 0,
                }))

                if (cell.id) {
                    // 기존 기록 업데이트
                    promises.push(
                        Promise.resolve(
                            supabase.from('meal_logs')
                                .update({ meal_items: items })
                                .eq('id', cell.id)
                        )
                    )
                } else if (items.length > 0) {
                    // 새 기록 삽입 - 반환된 ID를 그리드에 반영
                    promises.push(
                        Promise.resolve(
                            supabase.from('meal_logs')
                                .insert({
                                    user_id: user.id,
                                    baby_id: currentBaby.id,
                                    date,
                                    meal_type: mealType,
                                    meal_items: items,
                                    nutrition: { carbs: 0, protein: 0, fat: 0, vitamins: 0 }
                                })
                                .select('id')
                                .single()
                        ).then(({ data }) => {
                            if (data?.id) insertedIds[key] = data.id as string
                        })
                    )
                }
            }

            await Promise.all(promises)

            // 새로 삽입된 기록의 ID를 그리드에 반영 (reload 없이)
            if (Object.keys(insertedIds).length > 0) {
                isDbLoading.current = true
                setGrid(prev => {
                    const next = { ...prev }
                    for (const [key, id] of Object.entries(insertedIds)) {
                        if (next[key]) next[key] = { ...next[key], id }
                    }
                    return next
                })
                setTimeout(() => { isDbLoading.current = false }, 100)
            }

            setAutoSaveStatus('saved')
        } catch (e) {
            console.error(e)
            setAutoSaveStatus('error')
        } finally {
            setIsSaving(false)
            setTimeout(() => setAutoSaveStatus('idle'), 2500)
        }
    }, [user, currentBaby])

    // 항상 최신 saveGridToDb를 ref에 보관
    useEffect(() => {
        saveGridToDbRef.current = saveGridToDb
    }, [saveGridToDb])

    // 그리드가 변경될 때마다 디바운스 자동 저장
    // DB 로딩 중에는 실행하지 않음
    useEffect(() => {
        if (isDbLoading.current) return
        if (!user || !currentBaby) return
        if (Object.keys(grid).length === 0) return

        setAutoSaveStatus('pending')
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
        autoSaveTimer.current = setTimeout(() => {
            saveGridToDbRef.current?.(grid)
        }, AUTOSAVE_DEBOUNCE_MS)

        return () => {
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
        }

    }, [grid]) // grid 변경 시에만 트리거, 나머지 deps는 stable refs

    // 수동 저장 (기존 저장 버튼)
    const savePlan = async () => {
        if (!user) return
        if (!currentBaby) {
            alert("아기 프로필을 먼저 메인 페이지나 마이페이지에서 선택해주세요.")
            return
        }
        await saveGridToDb(grid)
    }

    // 장보기 목록 계산
    const shoppingList = useMemo(() => {
        const needed = new Map<string, number>()
        Object.values(grid).forEach(cell => {
            const validDishes = cell.dishes.filter(d => d.trim())
            if (!validDishes.length) return
            const knownIngNames = inventories.map(i => i.ingredient_name)
            const ings = cell.ingredients
                ? smartExtractIngredients(cell.ingredients, knownIngNames)
                : validDishes.flatMap(d => smartExtractIngredients(d.trim(), knownIngNames))
            ings.forEach(ing => needed.set(ing, (needed.get(ing) ?? 0) + 1))
        })
        const result: { name: string; count: number; inFridge: boolean; isOwnedButLow: boolean }[] = []
        needed.forEach((count, name) => {
            const inFridge = fridgeSet.has(name)
            const isOwnedButLow = lowStockSet.has(name)
            result.push({ name, count, inFridge, isOwnedButLow })
        })
        return result.sort((a, b) => Number(a.inFridge) - Number(b.inFridge))
    }, [grid, fridgeSet, lowStockSet])

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
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2 shadow-sm">
                            <button onClick={() => setWeekAnchor(d => addDays(d, -7))} className="p-1 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <span className="text-sm font-bold min-w-[150px] md:min-w-[160px] text-center">
                                {format(new Date(weekDates[0]), 'M월 d일', { locale: ko })} – {format(new Date(weekDates[6]), 'M월 d일 (EEE)', { locale: ko })}
                            </span>
                            <button onClick={() => setWeekAnchor(d => addDays(d, 7))} className="p-1 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                        {/* 데스크탑에서만 보이는 수동 저장 버튼 */}
                        <button
                            onClick={savePlan}
                            disabled={isSaving}
                            className={`hidden md:flex items-center gap-1.5 px-5 py-2.5 rounded-2xl font-black text-sm transition-all shadow-sm ${isSaving ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-primary text-slate-900 shadow-primary/20 hover:brightness-105 active:scale-95 text-primary-foreground'}`}
                        >
                            <span className={`material-symbols-outlined text-lg ${isSaving ? 'animate-spin' : ''}`}>
                                {isSaving ? 'sync' : 'save'}
                            </span>
                            저장
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ── 주간 그리드 ── */}
                    <div className="lg:col-span-2 overflow-x-auto">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden min-w-[300px] lg:min-w-[700px]">

                            {/* 데스크탑 뷰 (끼니가 행, 날짜가 열) - hidden on mobile */}
                            <div className="hidden md:block">
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

                                {/* 끼니별 행 - 셀 클릭 시 모달 열림 */}
                                {MEAL_TYPES.map(mealType => (
                                    <div key={mealType} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-50 dark:border-slate-800 last:border-0">
                                        <div className="p-2 flex flex-col items-center justify-center gap-0.5 bg-slate-50/50 dark:bg-slate-800/30">
                                            <span className="text-base">{MEAL_EMOJI[mealType]}</span>
                                            <span className="text-[10px] font-bold text-slate-400">{mealType}</span>
                                        </div>
                                        {weekDates.map(d => {
                                            const key = `${d}_${mealType}`
                                            const cell = grid[key] ?? { dishes: [], ingredients: '' }
                                            const validDishes = cell.dishes.filter(x => x.trim())
                                            const hasContent = validDishes.length > 0
                                            return (
                                                <div
                                                    key={key}
                                                    onClick={() => setSelectedCell({ date: d, mealType })}
                                                    className={`border-l border-slate-100 dark:border-slate-800 p-2 min-h-[90px] cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 flex flex-col justify-center ${hasContent ? '' : 'items-center group'}`}
                                                >
                                                    {hasContent ? (
                                                        <ul className="space-y-0.5 w-full">
                                                            {validDishes.map((dish, i) => (
                                                                <li key={i} className="flex items-start gap-1">
                                                                    {validDishes.length > 1 && <span className="text-primary text-[10px] mt-0.5 shrink-0">•</span>}
                                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight break-keep" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 1, overflow: 'hidden' }}>
                                                                        {dish}
                                                                    </p>
                                                                </li>
                                                            ))}
                                                            {cell.ingredients && (
                                                                <p className="text-[10px] text-slate-400 leading-tight mt-1" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 1, overflow: 'hidden' }}>
                                                                    {cell.ingredients}
                                                                </p>
                                                            )}
                                                        </ul>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-transparent group-hover:text-slate-300 dark:group-hover:text-slate-600 transition-colors">add</span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>

                            {/* 모바일 뷰 (날짜가 행, 각 날짜 안에 끼니 세로 나열) */}
                            <div className="md:hidden flex flex-col">
                                {weekDates.map(d => {
                                    const isToday = d === format(new Date(), 'yyyy-MM-dd')
                                    return (
                                        <div key={`mobile-${d}`} className={`flex flex-col border-b border-slate-200 dark:border-slate-800 last:border-0 ${isToday ? 'bg-primary/5' : ''}`}>
                                            {/* 날짜 헤더 */}
                                            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/80">
                                                <div className={`flex flex-col items-center justify-center w-10 ${isToday ? 'text-primary font-black' : 'text-slate-800 dark:text-slate-200'}`}>
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-0.5">{format(new Date(d), 'EEE', { locale: ko })}</span>
                                                    <span className="text-xl leading-none">{format(new Date(d), 'd')}</span>
                                                </div>
                                                <div className="flex-1">
                                                    {isToday && <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/20 text-primary rounded-md">오늘</span>}
                                                </div>
                                            </div>

                                            {/* 끼니 리스트 */}
                                            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                                                {MEAL_TYPES.map(mealType => {
                                                    const key = `${d}_${mealType}`
                                                    const cell = grid[key] ?? { dishes: [''], ingredients: '' }
                                                    const dishes = cell.dishes.length ? cell.dishes : ['']
                                                    return (
                                                        <div key={`mobile-${key}`} className="flex items-start p-3 gap-3">
                                                            {/* 아이콘 */}
                                                            <div className="flex flex-col items-center justify-center w-12 shrink-0 pt-2">
                                                                <span className="text-xl">{MEAL_EMOJI[mealType]}</span>
                                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">{mealType}</span>
                                                            </div>

                                                            {/* 음식 입력 목록 */}
                                                            <div className="flex-1 flex flex-col gap-2 min-w-0">
                                                                {dishes.map((dish, idx) => (
                                                                    <div key={idx} className="flex items-center gap-1.5">
                                                                        {dishes.length > 1 && (
                                                                            <span className="text-primary font-bold text-sm shrink-0">•</span>
                                                                        )}
                                                                        <input
                                                                            list={`mobile-past-${key}-${idx}`}
                                                                            value={dish}
                                                                            onChange={e => {
                                                                                const newDishes = [...dishes]
                                                                                newDishes[idx] = e.target.value
                                                                                updateCell(d, mealType, { dishes: newDishes })
                                                                            }}
                                                                            placeholder={idx === 0 ? "메뉴명을 입력하세요" : "음식 추가..."}
                                                                            onBlur={e => handleDishBlur(d, mealType, e.target.value)}
                                                                            onKeyUp={e => {
                                                                                if (e.key === 'Enter') handleDishBlur(d, mealType, (e.target as HTMLInputElement).value)
                                                                            }}
                                                                            className="flex-1 text-sm font-bold bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                                                                        />
                                                                        <datalist id={`mobile-past-${key}-${idx}`}>
                                                                            {pastMenus.map(m => <option key={`m-${m}`} value={m} />)}
                                                                        </datalist>
                                                                        {/* 항목이 2개 이상일 때 삭제 버튼 */}
                                                                        {dishes.length > 1 && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    const newDishes = dishes.filter((_, i) => i !== idx)
                                                                                    updateCell(d, mealType, { dishes: newDishes })
                                                                                }}
                                                                                className="p-1 text-slate-400 hover:text-red-400 transition-colors shrink-0"
                                                                            >
                                                                                <span className="material-symbols-outlined text-base">close</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}

                                                                {/* 음식 추가 버튼 */}
                                                                <button
                                                                    onClick={() => updateCell(d, mealType, { dishes: [...dishes, ''] })}
                                                                    className="flex items-center gap-1 text-xs text-primary font-bold hover:underline self-start"
                                                                >
                                                                    <span className="material-symbols-outlined text-sm">add</span>
                                                                    음식 추가
                                                                </button>

                                                                {/* 재료 입력 */}
                                                                <input
                                                                    value={cell.ingredients}
                                                                    onChange={e => updateCell(d, mealType, { ingredients: e.target.value })}
                                                                    placeholder="재료 (예: 소고기, 양파)"
                                                                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary/50 text-slate-600 dark:text-slate-300 placeholder:text-slate-400"
                                                                />
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                        </div>
                    </div>

                    {/* ── 장보기 목록 사이드바 (데스크탑전용) ── */}
                    <div className="hidden lg:flex flex-col gap-4">
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
                                    {missingItems.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">구매 필요 ({missingItems.length})</p>
                                            <div className="flex flex-col gap-1.5">
                                                {missingItems.map(item => (
                                                    <div
                                                        key={item.name}
                                                        className={`flex items-center gap-2 p-2.5 border rounded-xl transition-all ${item.isOwnedButLow
                                                            ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/30'
                                                            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30'
                                                            }`}
                                                    >
                                                        <span className={`material-symbols-outlined text-sm ${item.isOwnedButLow ? 'text-rose-500' : 'text-amber-500'}`}>
                                                            {item.isOwnedButLow ? 'info' : 'shopping_bag'}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{item.name}</span>
                                                                {item.isOwnedButLow && (
                                                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-rose-100 dark:bg-rose-500/30 text-rose-600 dark:text-rose-400 font-bold rounded-md">재고 부족</span>
                                                                )}
                                                            </div>
                                                            {item.isOwnedButLow && (
                                                                <p className="text-[10px] text-rose-500/80 font-medium">보유 중이나 모자람</p>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-slate-400 mr-1">{item.count}회</span>
                                                        <button
                                                            onClick={async () => {
                                                                if (!user) return
                                                                const existing = inventories.find(i =>
                                                                    i.ingredient_name.split(' (')[0].trim() === item.name
                                                                )
                                                                if (existing) return
                                                                const { data, error } = await supabase.from('inventory').insert({
                                                                    user_id: user.id,
                                                                    ingredient_name: item.name,
                                                                    expiry_date: null,
                                                                }).select().single()
                                                                if (!error && data) setInventories([data, ...inventories])
                                                            }}
                                                            className="flex items-center gap-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary font-bold px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">check</span>
                                                            이미 보유
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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

                {/* ── 데스크탑/태블릿용 입력 팝업 (Modal) ── */}
                {selectedCell && (() => {
                    const key = `${selectedCell.date}_${selectedCell.mealType}`
                    const cell = grid[key] ?? { dishes: [''], ingredients: '' }
                    const dishes = cell.dishes.length ? cell.dishes : ['']
                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm" onClick={() => setSelectedCell(null)}>
                            <div
                                className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* 모달 헤더 */}
                                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                                    <h3 className="font-extrabold text-lg flex items-center gap-2">
                                        <span className="text-2xl">{MEAL_EMOJI[selectedCell.mealType]}</span>
                                        {format(new Date(selectedCell.date), 'M월 d일 (EEE)', { locale: ko })} {selectedCell.mealType}
                                    </h3>
                                    <button onClick={() => setSelectedCell(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                        <span className="material-symbols-outlined text-xl">close</span>
                                    </button>
                                </div>

                                {/* 모달 바디 */}
                                <div className="p-6 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                                            음식 목록 <span className="text-slate-400 font-normal text-xs">(여러 가지 음식을 추가하세요)</span>
                                        </label>
                                        <div className="flex flex-col gap-2">
                                            {dishes.map((dish, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    {dishes.length > 1 && (
                                                        <span className="text-primary font-black text-base shrink-0">•</span>
                                                    )}
                                                    <input
                                                        list={`modal-past-${key}-${idx}`}
                                                        value={dish}
                                                        onChange={e => {
                                                            const newDishes = [...dishes]
                                                            newDishes[idx] = e.target.value
                                                            updateCell(selectedCell.date, selectedCell.mealType, { dishes: newDishes })
                                                        }}
                                                        placeholder={idx === 0 ? "어떤 음식을 드실 건가요?" : "음식 이름을 입력하세요"}
                                                        onBlur={e => handleDishBlur(selectedCell.date, selectedCell.mealType, e.target.value)}
                                                        onKeyUp={e => {
                                                            if (e.key === 'Enter') handleDishBlur(selectedCell.date, selectedCell.mealType, (e.target as HTMLInputElement).value)
                                                        }}
                                                        className="flex-1 text-base font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                                                        autoFocus={idx === 0}
                                                    />
                                                    <datalist id={`modal-past-${key}-${idx}`}>
                                                        {pastMenus.map(m => <option key={`modal-${m}`} value={m} />)}
                                                    </datalist>
                                                    {/* 삭제 버튼 (2개 이상일 때만) */}
                                                    {dishes.length > 1 && (
                                                        <button
                                                            onClick={() => {
                                                                const newDishes = dishes.filter((_, i) => i !== idx)
                                                                updateCell(selectedCell.date, selectedCell.mealType, { dishes: newDishes })
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors shrink-0"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* 음식 추가 버튼 */}
                                        <button
                                            onClick={() => updateCell(selectedCell.date, selectedCell.mealType, { dishes: [...dishes, ''] })}
                                            className="mt-3 flex items-center gap-1.5 text-sm text-primary font-bold px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-base">add_circle</span>
                                            음식 추가
                                        </button>
                                    </div>

                                    {/* 재료 */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">필요한 재료</label>
                                        <textarea
                                            value={cell.ingredients}
                                            onChange={e => updateCell(selectedCell.date, selectedCell.mealType, { ingredients: e.target.value })}
                                            placeholder="재료 (쉼표로 구분해 주세요)"
                                            className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 min-h-[80px] outline-none focus:ring-2 focus:ring-primary/50 text-slate-600 dark:text-slate-300 placeholder:text-slate-400 resize-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* 모달 푸터 */}
                                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                    <button
                                        onClick={() => setSelectedCell(null)}
                                        className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-sm hover:brightness-105 transition-all text-sm"
                                    >
                                        확인
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })()}
            </main>

            {/* 모바일 장보기 목록 FAB */}
            <button
                onClick={() => setIsShoppingOpen(true)}
                className="lg:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-primary text-primary-foreground font-bold px-4 py-3.5 rounded-2xl shadow-xl shadow-primary/30 hover:brightness-105 active:scale-95 transition-all"
            >
                <span className="material-symbols-outlined text-xl">shopping_cart</span>
                장보기 목록
                {missingItems.length > 0 && (
                    <span className="bg-red-500 text-white text-xs font-black rounded-full px-2 py-0.5 min-w-[20px] text-center leading-tight">
                        {missingItems.length}
                    </span>
                )}
            </button>

            {/* 모바일 장보기 목록 서랍 (Drawer) */}
            {isShoppingOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
                        onClick={() => setIsShoppingOpen(false)}
                    />
                    <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl z-50 lg:hidden flex flex-col">
                        {/* 서랍 헤더 */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">shopping_cart</span>
                                장보기 목록
                            </h2>
                            <div className="flex items-center gap-2">
                                {missingItems.length > 0 && (
                                    <button
                                        onClick={copyToClipboard}
                                        className="text-xs text-primary font-bold flex items-center gap-1 hover:underline"
                                    >
                                        <span className="material-symbols-outlined text-sm">content_copy</span>
                                        복사
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsShoppingOpen(false)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>

                        {/* 서랍 바디 */}
                        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                            {shoppingList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center flex-1 text-center py-20">
                                    <span className="material-symbols-outlined text-5xl text-slate-200 dark:text-slate-700 mb-3">shopping_cart</span>
                                    <p className="text-sm text-slate-400">이번 주 식단을 입력하면<br />필요한 재료가 자동으로 나타나요</p>
                                </div>
                            ) : (
                                <>
                                    {missingItems.length > 0 && (
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">구매 필요 ({missingItems.length})</p>
                                            <div className="flex flex-col gap-1.5">
                                                {missingItems.map(item => (
                                                    <div
                                                        key={item.name}
                                                        className={`flex items-center gap-2 p-2.5 border rounded-xl transition-all ${item.isOwnedButLow
                                                            ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/30'
                                                            : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30'
                                                            }`}
                                                    >
                                                        <span className={`material-symbols-outlined text-sm ${item.isOwnedButLow ? 'text-rose-500' : 'text-amber-500'}`}>
                                                            {item.isOwnedButLow ? 'info' : 'shopping_bag'}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{item.name}</span>
                                                                {item.isOwnedButLow && (
                                                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-rose-100 dark:bg-rose-500/30 text-rose-600 dark:text-rose-400 font-bold rounded-md">재고 부족</span>
                                                                )}
                                                            </div>
                                                            {item.isOwnedButLow && (
                                                                <p className="text-[10px] text-rose-500/80 font-medium">보유 중이나 모자람</p>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-slate-400 mr-1">{item.count}회</span>
                                                        <button
                                                            onClick={async () => {
                                                                if (!user) return
                                                                const existing = inventories.find(i =>
                                                                    i.ingredient_name.split(' (')[0].trim() === item.name
                                                                )
                                                                if (existing) return
                                                                const { data, error } = await supabase.from('inventory').insert({
                                                                    user_id: user.id,
                                                                    ingredient_name: item.name,
                                                                    expiry_date: null,
                                                                }).select().single()
                                                                if (!error && data) setInventories([data, ...inventories])
                                                            }}
                                                            className="flex items-center gap-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary font-bold px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">check</span>
                                                            이미 보유
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {shoppingList.filter(i => i.inFridge).length > 0 && (
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">냉장고 보유 ✅</p>
                                            <div className="flex flex-col gap-1">
                                                {shoppingList.filter(i => i.inFridge).map(item => (
                                                    <div key={item.name} className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl">
                                                        <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                                                        <span className="flex-1 text-sm font-medium text-slate-600 dark:text-slate-400 line-through">{item.name}</span>
                                                        <span className="text-xs text-emerald-500 font-bold">보유</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* 모바일 자동저장 상태 표시 (하단 고정 토스트) */}
            {autoSaveStatus !== 'idle' && (
                <div className={`md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-bold transition-all
                    ${autoSaveStatus === 'pending' ? 'bg-slate-800 text-white' : ''}
                    ${autoSaveStatus === 'saved' ? 'bg-emerald-500 text-white' : ''}
                    ${autoSaveStatus === 'error' ? 'bg-red-500 text-white' : ''}
                `}>
                    {autoSaveStatus === 'pending' && (
                        <>
                            <span className="material-symbols-outlined text-base animate-spin">sync</span>
                            저장 중...
                        </>
                    )}
                    {autoSaveStatus === 'saved' && (
                        <>
                            <span className="material-symbols-outlined text-base">check_circle</span>
                            자동 저장됨
                        </>
                    )}
                    {autoSaveStatus === 'error' && (
                        <>
                            <span className="material-symbols-outlined text-base">error</span>
                            저장 실패
                        </>
                    )}
                </div>
            )}

            <footer className="py-8 border-t border-slate-200 dark:border-slate-800 text-center">
                <p className="text-slate-400 text-sm">© 2026 맘마로그(MammaLog) — 스마트한 유아식 기록</p>
            </footer>
        </div>
    )
}
