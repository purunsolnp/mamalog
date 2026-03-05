"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { getMealLogs, getDailySummaries, getLatestGrowthSummary, getBabies, getProfile, getGrowthCharts } from '@/lib/api'
import { Header } from '@/components/layout/Header'
import { AuthModal } from '@/components/auth/AuthModal'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import { GrowthDetailModal } from '@/components/growth/GrowthDetailModal'
import { DailySummaryModal } from '@/components/meal/DailySummaryModal'
import { GrowthEntryModal } from '@/components/profile/GrowthEntryModal'
import { format, addDays, startOfWeek, differenceInMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import { smartExtractIngredients } from '@/lib/utils'
import { PlanCell } from '@/types/database.types'
import { ShoppingWidget } from '@/components/shopping/ShoppingWidget'
import { supabase } from '@/lib/supabase'
import { calculatePercentileFromChart } from '@/lib/growth'

const MEAL_TYPES = ['아침', '간식1', '점심', '간식2', '저녁']

const SATISFACTION_OPTIONS = [
  { value: 5, label: '다 먹음', icon: 'sentiment_very_satisfied', color: 'bg-emerald-500 text-white shadow-emerald-500/30', iconColor: 'text-emerald-500' },
  { value: 4, label: '반쯤', icon: 'sentiment_satisfied', color: 'bg-blue-400 text-white shadow-blue-400/30', iconColor: 'text-blue-500' },
  { value: 2, label: '조금', icon: 'sentiment_neutral', color: 'bg-amber-400 text-white shadow-amber-400/30', iconColor: 'text-amber-500' },
  { value: 1, label: '거의 안', icon: 'sentiment_dissatisfied', color: 'bg-red-400 text-white shadow-red-400/30', iconColor: 'text-red-500' },
]

function buildWeekDates(anchor: Date): string[] {
  const mon = startOfWeek(anchor, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => format(addDays(mon, i), 'yyyy-MM-dd'))
}

const AUTOSAVE_DEBOUNCE_MS = 1500

/* -----------------------------------------------
   Landing Hero – shown when user is NOT logged in
----------------------------------------------- */
function LandingHero({ onStart }: { onStart: () => void }) {
  return (
    <main className="flex-1 flex flex-col">
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="size-24 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/10">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 52 }}>child_care</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
          맘마로그<br />
          <span className="text-primary">MammaLog</span>
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-md mb-3 leading-relaxed">
          우리 아이의 <strong className="text-slate-700 dark:text-slate-200">이유식 · 유아식 기록</strong>을<br />
          달력으로 한눈에 관리하세요.
        </p>
        <p className="text-sm text-slate-400 mb-10">🌅 아침부터 🌙 저녁까지, 영양 잡힌 한 끼 기록</p>

        <button
          onClick={onStart}
          className="px-8 py-4 bg-primary text-slate-900 rounded-2xl font-bold text-lg shadow-xl shadow-primary/30 hover:brightness-105 hover:scale-105 active:scale-95 transition-all"
        >
          무료로 시작하기 →
        </button>
        <p className="text-xs text-slate-400 mt-4">카카오 또는 이메일로 1분만에 시작</p>
      </section>

      <section className="max-w-4xl mx-auto w-full px-6 pb-20 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { icon: 'calendar_month', color: 'bg-primary/10 text-primary', title: '달력 기반 기록', desc: '날짜별로 아침·점심·저녁·간식을 한눈에' },
          { icon: 'kitchen', color: 'bg-blue-100 text-blue-500', title: '냉장고 재료 관리', desc: '냉장고 재료를 등록하고 유통기한을 관리' },
          { icon: 'monitoring', color: 'bg-purple-100 text-purple-500', title: '영양 균형 추적', desc: '탄수화물·단백질·지방·비타민을 시각적으로' },
        ].map((f) => (
          <div key={f.title} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-3">
            <div className={`size-12 rounded-2xl ${f.color} flex items-center justify-center`}>
              <span className="material-symbols-outlined text-2xl">{f.icon}</span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">{f.title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  )
}

/* -----------------------------------------------
   Main App – shown when user IS logged in
----------------------------------------------- */
export default function Home() {
  const {
    user, setProfile,
    babies, setBabies, currentBaby, setCurrentBaby,
    inventories, setInventories,
    selectedDate, setDate,
    dailySummaries, setDailySummaries,
    growthCharts, setGrowthCharts,
    latestGrowthSummary, setLatestGrowthSummary,
    setAuthModalOpen,
    isProfileModalOpen, setProfileModalOpen,
  } = useAppStore()

  const [weekAnchor, setWeekAnchor] = useState(new Date())
  const weekDates = useMemo(() => buildWeekDates(weekAnchor), [weekAnchor])
  const [isSaving, setIsSaving] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saved' | 'error'>('idle')
  const [selectedCell, setSelectedCell] = useState<{ date: string; mealType: string } | null>(null)
  const [isShoppingOpen, setIsShoppingOpen] = useState(false)
  const [isGrowthModalOpen, setGrowthModalOpen] = useState(false)
  const [isGrowthEntryOpen, setGrowthEntryOpen] = useState(false)
  const [isDailySummaryOpen, setIsDailySummaryOpen] = useState(false)
  const [selectedSummaryDate, setSelectedSummaryDate] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'day' | 'week'; date?: string } | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // grid state: key = `${date}_${mealType}`
  const [grid, setGrid] = useState<Record<string, PlanCell>>({})
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    return { [todayStr]: true }
  })

  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]
  const isDbLoading = useRef(false)

  // Fetch initial data (Babies, Profile, Growth)
  useEffect(() => {
    if (!user) return

    async function fetchBaseData() {
      try {
        const babyList = await getBabies(user!.id)
        setBabies(babyList)

        let targetBaby = currentBaby
        if (!targetBaby && babyList.length > 0) {
          targetBaby = babyList[0]
          setCurrentBaby(targetBaby)
        }

        const [profileData] = await Promise.all([
          getProfile(user!.id),
        ])

        if (profileData) setProfile(profileData)

        if (targetBaby) {
          const gender = targetBaby.gender
          const [hAge, wAge, wH, latestSummary] = await Promise.all([
            getGrowthCharts('height_age', gender),
            getGrowthCharts('weight_age', gender),
            getGrowthCharts('weight_height', gender),
            getLatestGrowthSummary(user!.id, targetBaby.id)
          ])
          setGrowthCharts([...hAge, ...wAge, ...wH])
          setLatestGrowthSummary(latestSummary)
        }

        // Inventory
        const { data: invData } = await supabase.from('inventory').select('*').eq('user_id', user!.id)
        if (invData) setInventories(invData)

      } catch (e) {
        console.error("Fetch error:", e)
      }
    }
    fetchBaseData()
  }, [user, currentBaby?.id])

  // Fetch meal logs and daily summaries when week changes
  const loadLogsIntoGrid = useCallback(async () => {
    if (!user || !currentBaby) return
    isDbLoading.current = true
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const nextWeekStr = format(addDays(new Date(), 7), 'yyyy-MM-dd')
      const minStart = weekStart < todayStr ? weekStart : todayStr
      const maxEnd = weekEnd > nextWeekStr ? weekEnd : nextWeekStr

      const [logs, summaries] = await Promise.all([
        getMealLogs(user.id, minStart, maxEnd, currentBaby.id),
        getDailySummaries(user.id, minStart, maxEnd, currentBaby.id)
      ])

      setDailySummaries(summaries)
      setGrid(prev => {
        const next = { ...prev }
        for (const log of logs) {
          const key = `${log.date}_${log.meal_type}`
          const items = (log.meal_items ?? []).length > 0
            ? log.meal_items.map(i => ({
              name: i.name,
              satisfaction: i.satisfaction,
              ingredients: i.ingredients || []
            }))
            : [{ name: '', satisfaction: 0, ingredients: [] }]
          next[key] = { id: log.id, items }
        }
        return next
      })
    } catch (e) {
      console.error(e)
    } finally {
      setTimeout(() => { isDbLoading.current = false }, 100)
    }
  }, [user, weekStart, weekEnd, currentBaby])

  useEffect(() => {
    if (!user || !currentBaby) return
    loadLogsIntoGrid()
  }, [loadLogsIntoGrid, user, currentBaby])

  const updateCell = useCallback((date: string, mealType: string, patch: Partial<PlanCell>) => {
    const key = `${date}_${mealType}`
    const defaultCell: PlanCell = { items: [{ name: '', satisfaction: 0, ingredients: [] }] }
    setGrid(prev => ({
      ...prev,
      [key]: {
        ...defaultCell,
        ...(prev[key] ?? {}),
        ...patch,
      }
    }))
  }, [])

  const handleDishBlur = useCallback((date: string, mealType: string, dishIndex: number, dishName: string) => {
    if (!dishName.trim()) return
    const key = `${date}_${mealType}`
    const cell = grid[key] ?? { items: [] }
    const items = [...(cell.items || [])]
    const item = items[dishIndex] || { name: '', satisfaction: 0, ingredients: [] }

    const knownIngNames = inventories.map(i => i.ingredient_name)
    const extracted = smartExtractIngredients(dishName, knownIngNames)

    if (extracted.length > 0) {
      const currentIngs = item.ingredients || []
      const combined = new Set([...currentIngs, ...extracted])
      const newIngArray = Array.from(combined)

      if (JSON.stringify(newIngArray) !== JSON.stringify(currentIngs)) {
        items[dishIndex] = { ...item, ingredients: newIngArray }
        updateCell(date, mealType, { items })
      }
    }
  }, [grid, inventories, updateCell])

  const handleDeleteDay = useCallback(async (date: string) => {
    if (!user || !currentBaby) return
    setIsSaving(true)
    try {
      const dayKeys = MEAL_TYPES.map(m => `${date}_${m}`)
      const idsToDelete = dayKeys.map(k => grid[k]?.id).filter(Boolean) as string[]

      if (idsToDelete.length > 0) {
        await supabase.from('meal_logs').delete().in('id', idsToDelete)
      }

      setGrid(prev => {
        const next = { ...prev }
        dayKeys.forEach(k => {
          next[k] = { items: [{ name: '', satisfaction: 0, ingredients: [] }] }
        })
        return next
      })
      setAutoSaveStatus('saved')
    } catch (e) {
      console.error(e)
      setAutoSaveStatus('error')
    } finally {
      setIsSaving(false)
      setTimeout(() => setAutoSaveStatus('idle'), 2500)
    }
  }, [user, currentBaby, grid])

  const handleDeleteWeek = useCallback(async () => {
    if (!user || !currentBaby) return
    setIsSaving(true)
    try {
      const weekKeys: string[] = []
      weekDates.forEach(d => MEAL_TYPES.forEach(m => weekKeys.push(`${d}_${m}`)))
      const idsToDelete = weekKeys.map(k => grid[k]?.id).filter(Boolean) as string[]

      if (idsToDelete.length > 0) {
        await supabase.from('meal_logs').delete().in('id', idsToDelete)
      }

      setGrid(prev => {
        const next = { ...prev }
        weekKeys.forEach(k => {
          next[k] = { items: [{ name: '', satisfaction: 0, ingredients: [] }] }
        })
        return next
      })
      setAutoSaveStatus('saved')
    } catch (e) {
      console.error(e)
      setAutoSaveStatus('error')
    } finally {
      setIsSaving(false)
      setTimeout(() => setAutoSaveStatus('idle'), 2500)
    }
  }, [user, currentBaby, grid, weekDates])

  const saveGridToDb = useCallback(async (currentGrid: Record<string, PlanCell>) => {
    if (!user || !currentBaby) return
    setIsSaving(true)
    try {
      const insertedIds: Record<string, string> = {}
      const deletedIds: Record<string, string> = {}
      const promises: Promise<unknown>[] = []

      for (const [key, cell] of Object.entries(currentGrid)) {
        const validItems = cell.items?.filter(d => d.name.trim()) || []
        if (!validItems.length && !cell.id) continue

        const underscoreIdx = key.indexOf('_')
        const date = key.slice(0, underscoreIdx)
        const mealType = key.slice(underscoreIdx + 1)

        const items = validItems.map(item => ({
          name: item.name.trim(),
          ingredients: item.ingredients || [],
          satisfaction: item.satisfaction || 0,
        }))

        if (cell.id) {
          if (validItems.length > 0) {
            promises.push(Promise.resolve(supabase.from('meal_logs').update({ meal_items: items }).eq('id', cell.id)))
          } else {
            promises.push(Promise.resolve(supabase.from('meal_logs').delete().eq('id', cell.id)).then(() => { deletedIds[key] = cell.id! }))
          }
        } else if (items.length > 0) {
          promises.push(Promise.resolve(supabase.from('meal_logs').insert({
            user_id: user.id,
            baby_id: currentBaby.id,
            date,
            meal_type: mealType,
            meal_items: items,
            nutrition: { carbs: 0, protein: 0, fat: 0, vitamins: 0 }
          }).select('id').single()).then(({ data }) => {
            if (data?.id) insertedIds[key] = data.id as string
          }))
        }
      }
      await Promise.all(promises)
      if (Object.keys(insertedIds).length > 0 || Object.keys(deletedIds).length > 0) {
        isDbLoading.current = true
        setGrid(prev => {
          const next = { ...prev }
          for (const [key, id] of Object.entries(insertedIds)) if (next[key]) next[key] = { ...next[key], id }
          for (const key of Object.keys(deletedIds)) {
            if (next[key]) next[key] = { items: [{ name: '', satisfaction: 0, ingredients: [] }] }
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

  useEffect(() => {
    saveGridToDbRef.current = saveGridToDb
  }, [saveGridToDb])
  const saveGridToDbRef = useRef<((g: Record<string, PlanCell>) => Promise<void>) | null>(null)

  useEffect(() => {
    if (isDbLoading.current || !user || !currentBaby || Object.keys(grid).length === 0) return
    setAutoSaveStatus('pending')
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => { saveGridToDbRef.current?.(grid) }, AUTOSAVE_DEBOUNCE_MS)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [grid, user, currentBaby])

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const currentSummary = dailySummaries.find(s => s.date === dateStr && s.baby_id === currentBaby?.id)

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <Header />
        <AuthModal />
        <ProfileEditor isOpen={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} />
        <GrowthDetailModal isOpen={isGrowthModalOpen} onClose={() => setGrowthModalOpen(false)} />

        {!user ? (
          <LandingHero onStart={() => setAuthModalOpen(true)} />
        ) : (
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-5 relative z-10">
                {currentBaby && (
                  <div
                    onClick={() => setProfileModalOpen(true)}
                    className={`size-16 rounded-2xl flex items-center justify-center text-2xl font-black cursor-pointer hover:scale-105 transition-transform shadow-md ${currentBaby.gender === '남자' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                    {currentBaby.name[0]}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      {currentBaby ? `${currentBaby.name}의 식단 관리` : '식단 관리'}
                      <button
                        onClick={() => setGrowthEntryOpen(true)}
                        className="size-11 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary transition-colors flex items-center justify-center shadow-sm"
                        title="우리아이 성장 기록"
                      >
                        <span className="material-symbols-outlined text-2xl">monitoring</span>
                      </button>
                    </h1>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mt-1 relative group/date">
                    <span className="material-symbols-outlined text-xl group-hover/date:text-primary transition-colors">calendar_month</span>
                    <label className="cursor-pointer">
                      <input
                        type="date"
                        value={format(weekAnchor, 'yyyy-MM-dd') || ''}
                        className="absolute inset-0 opacity-0 cursor-pointer z-20 w-full"
                        onClick={(e) => {
                          try {
                            (e.currentTarget as any).showPicker();
                          } catch (err) { }
                        }}
                        onChange={(e) => {
                          if (e.target.value) {
                            setWeekAnchor(new Date(e.target.value))
                          }
                        }}
                      />
                      <span className="font-bold text-sm group-hover/date:text-primary transition-colors border-b border-dashed border-slate-300 dark:border-slate-700 group-hover/date:border-primary/50">
                        {format(new Date(weekDates[0]), 'M월 d일', { locale: ko })} – {format(new Date(weekDates[6]), 'M월 d일 (EEE)', { locale: ko })}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 relative z-10">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                  <button onClick={() => setWeekAnchor(d => addDays(d, -7))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-500">
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button onClick={() => setWeekAnchor(new Date())} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-primary">이번 주</button>
                  <button onClick={() => setWeekAnchor(d => addDays(d, 7))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-500">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
                <button
                  onClick={() => saveGridToDb(grid)}
                  disabled={isSaving}
                  className={`hidden md:flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-md ${isSaving ? 'bg-slate-100 text-slate-400' : 'bg-primary text-slate-900 shadow-primary/20 hover:brightness-105 active:scale-95'}`}
                >
                  <span className={`material-symbols-outlined text-xl ${isSaving ? 'animate-spin' : ''}`}>
                    {isSaving ? 'sync' : 'save'}
                  </span>
                  저장
                </button>
              </div>
            </div>



            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Planner Table (Left/Middle) */}
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  {/* Desktop Table View */}
                  <div className="hidden md:grid grid-cols-[100px_repeat(7,1fr)] bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                    <div className="p-4 flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-800 group/meal">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meal</span>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'week' })}
                        className="mt-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/meal:opacity-100 transition-opacity"
                        title="이번 주 전체 삭제"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                    {weekDates.map(d => {
                      const isToday = d === format(new Date(), 'yyyy-MM-dd')
                      const dayOfWeek = new Date(d).getDay()
                      const dayName = format(new Date(d), 'EEEE', { locale: ko })
                      const dayColor = dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : isToday ? 'text-primary' : 'text-slate-400'
                      const dateColor = dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : isToday ? 'text-primary' : 'text-slate-900 dark:text-slate-100'

                      return (
                        <div
                          key={d}
                          onClick={() => {
                            setSelectedSummaryDate(d)
                            setIsDailySummaryOpen(true)
                          }}
                          className={`p-4 text-center border-r border-slate-100 dark:border-slate-800 last:border-0 relative group/day cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isToday ? 'bg-primary/10' : ''}`}
                        >
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${dayColor}`}>
                            {dayName}
                          </p>
                          <p className={`text-lg font-black ${dateColor}`}>
                            {format(new Date(d), 'd')}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm({ type: 'day', date: d })
                            }}
                            className="absolute top-1 right-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/day:opacity-100 transition-opacity"
                            title="이 날 전체 삭제"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {MEAL_TYPES.map(mealType => (
                    <div key={mealType} className="hidden md:grid grid-cols-[100px_repeat(7,1fr)] border-b border-slate-50 dark:border-slate-800 last:border-0 group/row">
                      <div className="p-4 flex flex-col items-center justify-center bg-slate-50/30 dark:bg-slate-800/10 border-r border-slate-100 dark:border-slate-800">
                        <span className="text-base font-black text-slate-900 dark:text-slate-100">{mealType}</span>
                      </div>
                      {weekDates.map(d => {
                        const key = `${d}_${mealType}`
                        const cell = grid[key] ?? { items: [] }
                        const validItems = cell.items?.filter(x => x.name.trim()) || []
                        const hasContent = validItems.length > 0
                        return (
                          <div
                            key={key}
                            onClick={(e) => {
                              setDate(new Date(d));
                              setSelectedCell({ date: d, mealType });
                            }}
                            className={`p-3 min-h-[110px] border-r border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/40 relative group/cell ${hasContent ? 'bg-white dark:bg-slate-900' : ''}`}
                          >
                            <div className="flex flex-col h-full">
                              <div className="flex-1 space-y-1.5 overflow-hidden">
                                {validItems.map((item, i) => (
                                  <div key={i} className="flex flex-col gap-0.5">
                                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight line-clamp-2">
                                      {item.name}
                                    </p>
                                    {/* Desktop ingredients badges - REMOVED for readability as per user request */}
                                    {item.satisfaction > 0 && (
                                      <div className="flex gap-0.5">
                                        <span className={`material-symbols-outlined text-sm fill-current ${SATISFACTION_OPTIONS.find(o => o.value === item.satisfaction)?.iconColor || 'text-amber-500'}`}>
                                          {SATISFACTION_OPTIONS.find(o => o.value === item.satisfaction)?.icon || 'star'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {!hasContent && (
                                  <div className="h-full flex items-center justify-center">
                                    <span className="material-symbols-outlined text-slate-200 dark:text-slate-700 opacity-0 group-hover/cell:opacity-100 transition-opacity">add_circle</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>

                {/* Mobile ListView */}
                <div className="md:hidden flex flex-col">
                  {weekDates.map(d => {
                    const isToday = d === format(new Date(), 'yyyy-MM-dd')
                    const isExpanded = expandedDates[d] || false
                    return (
                      <div key={d} className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${isToday ? 'bg-primary/5' : ''}`}>
                        <div
                          onClick={() => setExpandedDates(prev => ({ ...prev, [d]: !prev[d] }))}
                          className="flex items-center gap-4 px-5 py-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <div className="flex flex-col items-center w-16 shrink-0">
                            <span className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${new Date(d).getDay() === 0 ? 'text-red-500' : new Date(d).getDay() === 6 ? 'text-blue-500' : isToday ? 'text-primary' : 'text-slate-500'}`}>
                              {format(new Date(d), 'EEEE', { locale: ko })}
                            </span>
                            <span className={`text-2xl font-black leading-none ${new Date(d).getDay() === 0 ? 'text-red-500' : new Date(d).getDay() === 6 ? 'text-blue-500' : isToday ? 'text-primary' : 'text-slate-900 dark:text-slate-100'}`}>
                              {format(new Date(d), 'd')}
                            </span>
                          </div>
                          <div className="flex-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isToday && <span className="text-[10px] font-black px-2 py-0.5 bg-primary/20 text-primary rounded-md">TODAY</span>}
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'day', date: d }) }}
                                className="p-1 px-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 text-[10px] font-bold"
                              >
                                삭제
                              </button>
                            </div>
                            <span className={`material-symbols-outlined text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-5 pb-5 space-y-4">
                            {MEAL_TYPES.map(mealType => {
                              const key = `${d}_${mealType}`
                              const cell = grid[key] ?? { items: [{ name: '', satisfaction: 0, ingredients: [] }] }
                              const validItems = cell.items?.filter(x => x.name.trim()) || []
                              return (
                                <div
                                  key={mealType}
                                  onClick={() => {
                                    setDate(new Date(d));
                                    setSelectedCell({ date: d, mealType });
                                  }} className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-black text-slate-900 dark:text-slate-100">{mealType}</span>
                                    <span className="material-symbols-outlined text-slate-300 text-lg">edit</span>
                                  </div>
                                  {validItems.length > 0 ? (
                                    <div className="space-y-3">
                                      {validItems.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                                          {item.satisfaction > 0 && (
                                            <span className={`material-symbols-outlined text-lg fill-current ${SATISFACTION_OPTIONS.find(o => o.value === item.satisfaction)?.iconColor || 'text-amber-500'}`}>
                                              {SATISFACTION_OPTIONS.find(o => o.value === item.satisfaction)?.icon || 'star'}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-300 font-bold">메뉴를 추가하세요</p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="lg:col-span-1 space-y-6">
                <ShoppingWidget inventories={inventories} localGrid={grid} layout="inline" />
              </div>
            </div>

            {/* Overview Stats Strip (Moved to bottom) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 mb-8">
              {[
                {
                  icon: 'water_drop',
                  color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-500',
                  value: currentSummary?.water_ml ? `${currentSummary.water_ml} ml` : '기록 없음',
                  label: '오늘의 수분 섭취'
                },
                {
                  icon: 'bedtime',
                  color: 'bg-purple-100 dark:bg-purple-500/20 text-purple-500',
                  value: currentSummary?.sleep_hours ? `${currentSummary.sleep_hours} 시간` : '기록 없음',
                  label: '오늘의 수면 시간'
                },
                {
                  icon: 'monitoring',
                  color: 'bg-primary/20 text-primary',
                  value: (() => {
                    if (!currentBaby) return '아이 정보 필요'
                    const targetSummary = currentSummary?.weight_kg ? currentSummary : latestGrowthSummary
                    if (!targetSummary?.weight_kg) return '체중 기록 없음'
                    const gender = currentBaby.gender
                    const ageInMonths = differenceInMonths(new Date(targetSummary.date), new Date(currentBaby.birthday || new Date()))
                    if (targetSummary.height_cm) {
                      const whChart = growthCharts.filter(c => c.type === 'weight_height')
                      if (whChart.length > 0) return calculatePercentileFromChart(whChart, targetSummary.height_cm, targetSummary.weight_kg)
                    }
                    const waChart = growthCharts.filter(c => c.type === 'weight_age')
                    if (waChart.length > 0) return calculatePercentileFromChart(waChart, ageInMonths, targetSummary.weight_kg)
                    return '데이터 부족'
                  })(),
                  label: `${currentBaby?.name || '아이'} 성장 백분위`,
                  action: () => setGrowthModalOpen(true)
                },
              ].map((s) => (
                <div
                  key={s.label}
                  onClick={s.action}
                  className={`bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 hover:border-primary/30 transition-all group ${s.action ? 'cursor-pointer' : ''}`}
                >
                  <div className={`size-12 rounded-2xl ${s.color} flex items-center justify-center group-hover:scale-110 transition-transform shrink-0`}>
                    <span className="material-symbols-outlined text-3xl">{s.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate mb-0.5">{s.label}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white truncate">{s.value}</p>
                  </div>
                  {s.action && (
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors shrink-0">chevron_right</span>
                  )}
                </div>
              ))}
            </div>
          </main>
        )
        }

        {/* Unified Editor Modal */}
        {
          selectedCell && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedCell(null)}>
              <div
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-2xl text-slate-900 dark:text-slate-100">
                      {format(new Date(selectedCell.date), 'M월 d일 (EEE)', { locale: ko })} {selectedCell.mealType}
                    </h3>
                    <p className="text-sm text-slate-400 font-bold mt-1">오늘 아기는 얼마나 잘 먹었나요?</p>
                  </div>
                  <button onClick={() => setSelectedCell(null)} className="p-3 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
                    <span className="material-symbols-outlined text-2xl font-black">close</span>
                  </button>
                </div>

                {/* Body */}
                <div className="p-8 flex-1 overflow-y-auto space-y-8">
                  {/* Food Items */}
                  <div className="space-y-6">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">음식 목록</label>
                    <div className="space-y-6">
                      {(grid[`${selectedCell.date}_${selectedCell.mealType}`]?.items || [{ name: '', satisfaction: 0, ingredients: [] }]).map((item, idx, items) => (
                        <div key={idx} className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/50 space-y-5">
                          <div className="flex items-center gap-3">
                            <input
                              value={item.name}
                              onChange={e => {
                                const newItems = [...items]
                                newItems[idx] = { ...item, name: e.target.value }
                                updateCell(selectedCell.date, selectedCell.mealType, { items: newItems })
                              }}
                              placeholder="메뉴를 입력하세요"
                              onBlur={e => handleDishBlur(selectedCell.date, selectedCell.mealType, idx, e.target.value)}
                              className="flex-1 text-xl font-black bg-transparent border-none p-0 outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-200"
                              autoFocus={idx === items.length - 1}
                            />
                            <button
                              onClick={() => {
                                const newItems = items.filter((_, i) => i !== idx)
                                updateCell(selectedCell.date, selectedCell.mealType, { items: newItems.length ? newItems : [{ name: '', satisfaction: 0, ingredients: [] }] })
                              }}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </div>

                          {/* Ingredients Tagging UI */}
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">준비된 재료</label>
                            <div className="flex flex-wrap gap-2 p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl min-h-[64px]">
                              {item.ingredients?.map((ing, ii) => (
                                <span key={ii} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-[13px] font-black animate-in fade-in zoom-in duration-200 group/tag">
                                  {ing}
                                  <button
                                    onClick={() => {
                                      const newItems = [...items]
                                      const newIngs = [...item.ingredients]
                                      newIngs.splice(ii, 1)
                                      newItems[idx] = { ...item, ingredients: newIngs }
                                      updateCell(selectedCell.date, selectedCell.mealType, { items: newItems })
                                    }}
                                    className="size-4 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-full flex items-center justify-center transition-colors text-slate-400 hover:text-red-500"
                                  >
                                    <span className="material-symbols-outlined text-[10px] font-black">close</span>
                                  </button>
                                </span>
                              ))}
                              <input
                                type="text"
                                placeholder={item.ingredients?.length ? "" : "재료를 입력하고 콤마(,)나 엔터를 치세요"}
                                className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm font-bold text-slate-700 dark:text-slate-300 pt-0.5"
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ',') {
                                    e.preventDefault()
                                    const val = e.currentTarget.value.trim().replace(/,$/, '')
                                    if (val) {
                                      const knownIngNames = inventories.map(i => i.ingredient_name)
                                      const extracted = smartExtractIngredients(val, knownIngNames)
                                      if (extracted.length > 0) {
                                        const newItems = [...items]
                                        const currentIngs = item.ingredients || []
                                        const combined = new Set([...currentIngs, ...extracted])
                                        newItems[idx] = { ...item, ingredients: Array.from(combined) }
                                        updateCell(selectedCell.date, selectedCell.mealType, { items: newItems })
                                        e.currentTarget.value = ''
                                      }
                                    }
                                  }
                                }}
                                onBlur={e => {
                                  const val = e.currentTarget.value.trim()
                                  if (val) {
                                    const knownIngNames = inventories.map(i => i.ingredient_name)
                                    const extracted = smartExtractIngredients(val, knownIngNames)
                                    if (extracted.length > 0) {
                                      const newItems = [...items]
                                      const currentIngs = item.ingredients || []
                                      const combined = new Set([...currentIngs, ...extracted])
                                      newItems[idx] = { ...item, ingredients: Array.from(combined) }
                                      updateCell(selectedCell.date, selectedCell.mealType, { items: newItems })
                                      e.currentTarget.value = ''
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {SATISFACTION_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  const newItems = [...items]
                                  newItems[idx] = { ...item, satisfaction: opt.value }
                                  updateCell(selectedCell.date, selectedCell.mealType, { items: newItems })
                                }}
                                className={`flex-1 group flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all border ${item.satisfaction === opt.value
                                  ? `${opt.color} border-transparent`
                                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 hover:border-primary/50'
                                  }`}
                              >
                                <span className={`material-symbols-outlined text-2xl ${item.satisfaction === opt.value ? 'fill-current' : ''}`}>
                                  {opt.icon}
                                </span>
                                <span className="text-[10px] font-black uppercase">{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const cell = grid[`${selectedCell.date}_${selectedCell.mealType}`] || { items: [] }
                          const items = cell.items || []
                          updateCell(selectedCell.date, selectedCell.mealType, { items: [...items, { name: '', satisfaction: 0, ingredients: [] }] })
                        }}
                        className="w-full py-4 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800 text-slate-400 font-black hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined">add_circle</span>
                        음식 추가하기
                      </button>
                    </div>
                  </div>

                  {/* Internal state sync (keeping this for database logic safety but ingredients are now per-item) */}
                  <div className="hidden">
                    <textarea value={""} readOnly />
                  </div>

                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition-all"
                  >
                    기록 완료
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* Mobile FAB Autosave status */}
        {
          autoSaveStatus !== 'idle' && (
            <div className={`md:hidden fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-bold transition-all
                        ${autoSaveStatus === 'pending' ? 'bg-slate-800 text-white' : ''}
                        ${autoSaveStatus === 'saved' ? 'bg-emerald-500 text-white' : ''}
                        ${autoSaveStatus === 'error' ? 'bg-red-500 text-white' : ''}
                    `}>
              {autoSaveStatus === 'pending' && <span className="material-symbols-outlined text-base animate-spin">sync</span>}
              {autoSaveStatus === 'saved' && <span className="material-symbols-outlined text-base">check_circle</span>}
              {autoSaveStatus === 'error' && <span className="material-symbols-outlined text-base">error</span>}
              <span>{autoSaveStatus === 'pending' ? '저장 중' : autoSaveStatus === 'saved' ? '저장됨' : '저장 실패'}</span>
            </div>
          )
        }

        {/* Mobile Shopping FAB */}
        <button
          onClick={() => setIsShoppingOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-primary text-slate-900 font-black px-5 py-4 rounded-2xl shadow-xl shadow-primary/30 hover:brightness-105 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-xl">shopping_cart</span>
          장보기
        </button>

        {/* Mobile Shopping Drawer */}
        {
          isShoppingOpen && (
            <>
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsShoppingOpen(false)} />
              <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl z-50 lg:hidden flex flex-col pt-10">
                <div className="absolute top-4 right-4 z-50">
                  <button onClick={() => setIsShoppingOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <ShoppingWidget inventories={inventories} localGrid={grid} layout="inline" className="h-full border-0 shadow-none" />
              </div>
            </>
          )
        }

        {/* New Modals */}
        <GrowthEntryModal
          isOpen={isGrowthEntryOpen}
          onClose={() => setGrowthEntryOpen(false)}
        />
        {
          selectedSummaryDate && (
            <DailySummaryModal
              date={selectedSummaryDate}
              isOpen={isDailySummaryOpen}
              onClose={() => {
                setIsDailySummaryOpen(false)
                setSelectedSummaryDate(null)
              }}
            />
          )
        }

        {/* Delete Confirmation Modal */}
        {
          deleteConfirm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-sm p-8 shadow-2xl space-y-6" onClick={e => e.stopPropagation()}>
                <div className="text-center space-y-2">
                  <div className="size-16 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-4xl">warning</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">정말 삭제하시겠습니까?</h3>
                  <p className="text-sm text-slate-500">
                    {deleteConfirm.type === 'day'
                      ? `${format(new Date(deleteConfirm.date!), 'M월 d일')}의 모든 식단 기록이 삭제됩니다.`
                      : '이번 주의 모든 식단 기록이 삭제됩니다.'}
                    <br />삭제된 데이터는 복구할 수 없습니다.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    아니오
                  </button>
                  <button
                    onClick={() => {
                      if (deleteConfirm.type === 'day') handleDeleteDay(deleteConfirm.date!)
                      else handleDeleteWeek()
                      setDeleteConfirm(null)
                    }}
                    className="flex-1 py-4 bg-red-500 text-white font-black rounded-2xl shadow-lg shadow-red-500/30 hover:brightness-110 active:scale-95 transition-all"
                  >
                    네, 삭제할게요
                  </button>
                </div>
              </div>
            </div>
          )
        }

        <footer className="mt-12 py-10 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">© 2026 MammaLog — Smart Meal Planning</p>
        </footer>
      </div >
    </div >
  )
}
