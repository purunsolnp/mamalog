"use client"

import { Header } from '@/components/layout/Header'
import { CalendarDashboard } from '@/components/calendar/CalendarDashboard'
import { MealTabs } from '@/components/meal/MealTabs'
import { MealLogCard } from '@/components/meal/MealLogCard'
import { MealEditor } from '@/components/meal/MealEditor'
import { DailySummaryEditor } from '@/components/meal/DailySummaryEditor'
import { AuthModal } from '@/components/auth/AuthModal'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import { GrowthDetailModal } from '@/components/growth/GrowthDetailModal'
import { useAppStore } from '@/lib/store'
import { getMealLogs, getDailySummaries, getProfile, getGrowthCharts, getBabies } from '@/lib/api'
import { calculatePercentileFromChart } from '@/lib/growth'
import { format, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useState, useEffect } from 'react'

/* -----------------------------------------------
   Landing Hero – shown when user is NOT logged in
----------------------------------------------- */
function LandingHero({ onStart }: { onStart: () => void }) {
  return (
    <main className="flex-1 flex flex-col">
      {/* Hero */}
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

      {/* Feature Cards */}
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
    user, profile, setProfile,
    babies, setBabies, currentBaby, setCurrentBaby,
    selectedDate, isEditorOpen, setEditorOpen,
    logs, setLogs, dailySummaries, setDailySummaries,
    growthCharts, setGrowthCharts,
    editingLog, setEditingLog,
    setAuthModalOpen
  } = useAppStore()
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)
  const [isGrowthModalOpen, setGrowthModalOpen] = useState(false)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const selectedDayLogs = logs.filter(log => log.date === dateStr)
  const currentSummary = dailySummaries.find(s => s.date === dateStr)

  // Fetch initial data
  useEffect(() => {
    if (!user) return

    async function fetchData() {
      try {
        const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd')
        const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd')

        // 1. Fetch Babies first to know who we are looking at
        const babyList = await getBabies(user!.id)
        setBabies(babyList)

        let targetBaby = currentBaby
        if (!targetBaby && babyList.length > 0) {
          targetBaby = babyList[0]
          setCurrentBaby(targetBaby)
        }

        // 2. Fetch logs and summaries for the current baby
        const [mealData, summaryData, profileData] = await Promise.all([
          getMealLogs(user!.id, start, end, targetBaby?.id),
          getDailySummaries(user!.id, start, end, targetBaby?.id),
          getProfile(user!.id)
        ])

        setLogs(mealData)
        setDailySummaries(summaryData)
        if (profileData) setProfile(profileData)

        // 3. Fetch growth charts if we have a baby
        if (targetBaby) {
          const gender = targetBaby.gender
          const [hAge, wAge, wH] = await Promise.all([
            getGrowthCharts('height_age', gender),
            getGrowthCharts('weight_age', gender),
            getGrowthCharts('weight_height', gender)
          ])
          setGrowthCharts([...hAge, ...wAge, ...wH])
        }
      } catch (e) {
        console.error("Fetch error:", e)
      }
    }
    fetchData()
  }, [user, selectedDate, currentBaby?.id, setLogs, setDailySummaries, setProfile, setGrowthCharts, setBabies, setCurrentBaby])

  const handleCloseModal = () => {
    setEditorOpen(false)
    setIsAddingNew(false)
    setEditingLog(null)
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <Header />
        <AuthModal />
        <ProfileEditor isOpen={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} />
        <GrowthDetailModal isOpen={isGrowthModalOpen} onClose={() => setGrowthModalOpen(false)} />

        {/* ---- NOT logged in: show Landing ---- */}
        {!user ? (
          <LandingHero onStart={() => setAuthModalOpen(true)} />
        ) : (
          /* ---- Logged in: show Dashboard ---- */
          <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">

            {/* Title Section */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4">
                {currentBaby && (
                  <div
                    onClick={() => setProfileModalOpen(true)}
                    className={`size-14 rounded-2xl flex items-center justify-center text-xl font-black cursor-pointer hover:scale-105 transition-transform shadow-md ${currentBaby.gender === '남자' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                      }`}>
                    {currentBaby.name[0]}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black tracking-tight">
                      {currentBaby ? `${currentBaby.name}의 식단` : '일간 식단 기록'}
                    </h1>
                    {babies.length > 1 && (
                      <button
                        onClick={() => setProfileModalOpen(true)}
                        className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-bold uppercase tracking-wider"
                      >
                        전환
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="material-symbols-outlined text-lg">event</span>
                    <span className="font-bold text-sm">{format(selectedDate, 'MMMM d일 (EEE)', { locale: ko })}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setProfileModalOpen(true)}
                  className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  title="아이 프로필 관리"
                >
                  <span className="material-symbols-outlined">child_care</span>
                </button>
                <button
                  onClick={() => {
                    if (!currentBaby) {
                      // 아기 프로필 없으면 먼저 프로필 설정 유도
                      setProfileModalOpen(true)
                    } else {
                      setIsAddingNew(false)
                      setEditorOpen(true)
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-slate-900 rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:brightness-105 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  식단 기록 추가
                </button>
              </div>
            </div>

            <CalendarDashboard />

            {/* Summary Strip */}
            <div className="mt-12">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined text-primary">analytics</span>
                일간 요약
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  {
                    icon: 'water_drop',
                    color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-500',
                    value: currentSummary?.water_ml ? `${currentSummary.water_ml} ml` : '기록 없음',
                    label: '수분 섭취량'
                  },
                  {
                    icon: 'bedtime',
                    color: 'bg-purple-100 dark:bg-purple-500/20 text-purple-500',
                    value: currentSummary?.sleep_hours ? `${currentSummary.sleep_hours} 시간` : '기록 없음',
                    label: '총 수면 시간'
                  },
                  {
                    icon: 'monitoring',
                    color: 'bg-primary/20 text-primary',
                    value: (() => {
                      if (!currentBaby) return '아이 정보 필요'
                      if (!currentSummary?.weight_kg) return '체중 기록 대기'

                      const gender = currentBaby.gender
                      const ageInMonths = differenceInMonths(new Date(), new Date(currentBaby.birthday || new Date()))

                      // Priority 1: Weight-for-Height
                      if (currentSummary.height_cm) {
                        const whChart = growthCharts.filter(c => c.type === 'weight_height')
                        if (whChart.length > 0) {
                          return calculatePercentileFromChart(whChart, currentSummary.height_cm, currentSummary.weight_kg)
                        }
                      }

                      // Priority 2: Weight-for-Age
                      const waChart = growthCharts.filter(c => c.type === 'weight_age')
                      if (waChart.length > 0) {
                        return calculatePercentileFromChart(waChart, ageInMonths, currentSummary.weight_kg)
                      }

                      return '데이터를 분석 중...'
                    })(),
                    label: currentBaby ? `${currentBaby.name} 성장 상태` : '성장 상태',
                    action: () => setGrowthModalOpen(true)
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    onClick={s.action}
                    className={`bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 hover:border-primary/30 transition-all group ${s.action ? 'cursor-pointer' : ''}`}
                  >
                    <div className={`size-12 rounded-2xl ${s.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <span className="material-symbols-outlined text-3xl">{s.icon}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{s.label}</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white truncate">{s.value}</p>
                    </div>
                    {s.action && (
                      <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">settings</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </main>
        )}

        {/* Meal Editor Modal */}
        {isEditorOpen && (
          <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm overflow-y-auto p-4 md:p-8 flex items-start justify-center">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-6xl relative shadow-2xl flex flex-col mt-4">

              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-xl text-primary">
                    <span className="material-symbols-outlined">edit_calendar</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold dark:text-white">
                      {format(selectedDate, 'MM월 dd일 (EEE)', { locale: ko })} 식단
                    </h2>
                    <p className="text-sm text-slate-500">{selectedDayLogs.length}개의 기록이 있어요</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 md:p-8">
                {/* Existing Logs */}
                {selectedDayLogs.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">기록된 식단</h3>
                    <div className="flex flex-col gap-2">
                      {selectedDayLogs.map(log => (
                        <MealLogCard key={log.id} log={log} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Daily Summary Editor */}
                <div className="mb-8">
                  <DailySummaryEditor />
                </div>

                {/* Add New / Edit Toggle */}
                {!isAddingNew && !editingLog ? (
                  <button
                    onClick={() => setIsAddingNew(true)}
                    className="w-full py-4 border-2 border-dashed border-primary/30 hover:border-primary/60 text-primary font-bold rounded-2xl flex items-center justify-center gap-2 transition-all hover:bg-primary/5"
                  >
                    <span className="material-symbols-outlined">add_circle</span>
                    새 식단 추가하기
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                        {editingLog ? '식단 수정' : '새 식단 추가'}
                      </h3>
                      <button
                        onClick={() => { setIsAddingNew(false); setEditingLog(null) }}
                        className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">expand_less</span>
                        접기
                      </button>
                    </div>
                    <MealTabs />
                    <MealEditor />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <footer className="mt-12 py-8 border-t border-slate-200 dark:border-slate-800 text-center">
          <p className="text-slate-400 text-sm">© 2026 맘마로그(MammaLog) — 스마트한 유아식 기록</p>
        </footer>
      </div>
    </div>
  )
}
