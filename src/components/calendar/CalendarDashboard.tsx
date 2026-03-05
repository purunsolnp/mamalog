"use client"

import { useState, useEffect } from 'react'
import {
    format, addMonths, subMonths, startOfMonth,
    endOfMonth, startOfWeek, endOfWeek, isSameMonth,
    isSameDay, addDays, subWeeks, addWeeks
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { useAppStore } from '@/lib/store'
import { getMealLogs } from '@/lib/api'

export function CalendarDashboard() {
    const { user, currentBaby, selectedDate, setDate, setEditorOpen, logs, setLogs } = useAppStore()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [isLoading, setIsLoading] = useState(false)
    const [viewMode, setViewMode] = useState<'week' | 'month'>('month')

    // Automatically determine initial viewMode based on screen size
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setViewMode('week')
            } else {
                setViewMode('month')
            }
        }

        handleResize() // Set initially

        // Ensure month is selected correctly for the new viewMode based on selectedDate
        setCurrentDate(selectedDate || new Date())

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Fetch logs when the visible date range changes or user changes
    useEffect(() => {
        if (!user) {
            setLogs([])
            return
        }

        const fetchLogs = async () => {
            setIsLoading(true)
            try {
                let start: Date
                let end: Date

                if (viewMode === 'month') {
                    start = startOfMonth(currentDate)
                    end = endOfMonth(currentDate)
                } else {
                    start = startOfWeek(currentDate)
                    end = endOfWeek(currentDate)
                }

                // Fetch a slightly broader window (e.g. current month/week + some buffer)
                // Actually the calendar renders `startOfWeek` for month view anyway, let's include surrounding days
                const queryStart = startOfWeek(startOfMonth(currentDate))
                const queryEnd = endOfWeek(endOfMonth(currentDate))

                const data = await getMealLogs(
                    user.id,
                    format(queryStart, 'yyyy-MM-dd'),
                    format(queryEnd, 'yyyy-MM-dd'),
                    currentBaby?.id
                )
                setLogs(data)
            } catch (error) {
                console.error("Failed to load calendar logs", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchLogs()
    }, [user, currentDate, viewMode, setLogs, currentBaby?.id])


    const onDateClick = (day: Date) => {
        setDate(day)
        setEditorOpen(true)
    }

    const handlePrevious = () => {
        if (viewMode === 'month') {
            setCurrentDate(subMonths(currentDate, 1))
        } else {
            setCurrentDate(subWeeks(currentDate, 1))
        }
    }

    const handleNext = () => {
        if (viewMode === 'month') {
            setCurrentDate(addMonths(currentDate, 1))
        } else {
            setCurrentDate(addWeeks(currentDate, 1))
        }
    }

    const renderHeader = () => {
        return (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl md:text-2xl font-bold dark:text-white capitalize">
                        {viewMode === 'month'
                            ? format(currentDate, 'yyyy년 M월')
                            : `${format(startOfWeek(currentDate), 'M월 d일')} - ${format(endOfWeek(currentDate), 'M월 d일')}`
                        }
                    </h2>
                    <div className="flex gap-1.5">
                        <button
                            onClick={handlePrevious}
                            className="p-1.5 md:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">chevron_left</span>
                        </button>
                        <button
                            onClick={handleNext}
                            className="p-1.5 md:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">chevron_right</span>
                        </button>
                    </div>
                </div>

                {/* View Toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit self-end sm:self-auto">
                    <button
                        onClick={() => setViewMode('week')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'week' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        주간
                    </button>
                    <button
                        onClick={() => setViewMode('month')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        월간
                    </button>
                </div>
            </div>
        )
    }

    const renderDays = () => {
        if (viewMode === 'week') return null; // 주간 뷰에서는 상단 요일 헤더를 숨김 (각 행에 요일 표시)

        const startDate = startOfWeek(currentDate)
        const days = []
        for (let i = 0; i < 7; i++) {
            days.push(
                <div key={i} className="text-center text-[10px] md:text-xs font-bold text-slate-400 uppercase py-1 md:py-2">
                    {format(addDays(startDate, i), 'EEE', { locale: ko })}
                </div>
            )
        }
        return <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 md:mb-4">{days}</div>
    }

    const renderCells = () => {
        let startDate: Date
        let endDate: Date
        const monthStart = startOfMonth(currentDate)

        if (viewMode === 'month') {
            const monthEnd = endOfMonth(monthStart)
            startDate = startOfWeek(monthStart)
            endDate = endOfWeek(monthEnd)
        } else {
            startDate = startOfWeek(currentDate)
            endDate = endOfWeek(currentDate)
        }

        const rows = []
        let days = []
        let day = startDate

        if (viewMode === 'week') {
            // 주간 뷰 (1x7 세로 리스트 형태)
            while (day <= endDate) {
                const cloneDay = day
                const isSelected = isSameDay(day, selectedDate)
                const dateStr = format(day, 'yyyy-MM-dd')
                const allDayLogs = logs.filter(log => log.date === dateStr)

                const MEAL_ORDER = ['아침', '간식1', '점심', '간식2', '저녁']
                const MEAL_EMOJI: Record<string, string> = {
                    '아침': '🌅', '간식1': '🍪', '점심': '🍱', '간식2': '🧃', '저녁': '🌙',
                }
                const dayLogs = [...allDayLogs].sort((a, b) =>
                    MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type)
                )

                const hasLogs = dayLogs.length > 0
                const isToday = isSameDay(day, new Date())

                rows.push(
                    <div
                        key={day.toISOString()}
                        onClick={() => onDateClick(cloneDay)}
                        className={`rounded-2xl border min-h-[100px] p-4 flex gap-4 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] mb-3 w-full
                                    ${isSelected ? 'bg-primary/10 border-primary shadow-sm ring-1 ring-primary/50' :
                                'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-primary/30 shadow-sm'}`}
                    >
                        {/* 왼쪽 날짜 영역 */}
                        <div className="flex flex-col items-center justify-center min-w-[50px]">
                            <span className={`text-xs font-bold uppercase mb-1 ${isToday ? 'text-primary' : 'text-slate-400'}`}>
                                {format(day, 'EEE', { locale: ko })}
                            </span>
                            <span className={`text-2xl font-black ${isToday ? 'text-primary' : 'text-slate-800 dark:text-slate-100'}`}>
                                {format(day, 'd')}
                            </span>
                        </div>

                        {/* 구분선 */}
                        <div className="w-px bg-slate-100 dark:bg-slate-700 mx-2"></div>

                        {/* 오른쪽 식단 영역 */}
                        <div className="flex-1 flex flex-col justify-center">
                            {hasLogs ? (
                                <div className="flex flex-wrap gap-2">
                                    {dayLogs.map((log, idx) => {
                                        let chipBg = "bg-primary/15 text-primary-900 dark:text-primary-100"
                                        if (log.satisfaction === 4) chipBg = "bg-blue-400/15 text-blue-900 dark:text-blue-100"
                                        if (log.satisfaction === 2) chipBg = "bg-amber-400/15 text-amber-900 dark:text-amber-100"
                                        if (log.satisfaction === 1) chipBg = "bg-red-400/15 text-red-900 dark:text-red-100"

                                        const emoji = MEAL_EMOJI[log.meal_type] ?? '🍽️'
                                        const menuText = log.meal_items && log.meal_items.length > 0
                                            ? log.meal_items.map(i => i.name).filter(Boolean).join(' · ')
                                            : log.meal_name || log.meal_type

                                        return (
                                            <div
                                                key={idx}
                                                className={`text-xs md:text-sm font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 ${chipBg}`}
                                            >
                                                <span>{emoji} {log.meal_type}</span>
                                                <span className="opacity-50">|</span>
                                                <span className="truncate max-w-[150px] md:max-w-xs">{menuText}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-slate-300 dark:text-slate-600 text-sm font-medium flex items-center h-full">
                                    기록된 식단이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                )
                day = addDays(day, 1)
            }
            return <div className="flex flex-col flex-1">{rows}</div>

        } else {
            // 월간 뷰 (7xN 그리드 형태 - 기존 로직)
            let formattedDate = ""
            while (day <= endDate) {
                for (let i = 0; i < 7; i++) {
                    formattedDate = format(day, 'd')
                    const cloneDay = day
                    const isSelected = isSameDay(day, selectedDate)
                    const isCurrentMonth = isSameMonth(day, monthStart)
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const allDayLogs = logs.filter(log => log.date === dateStr)

                    const MEAL_ORDER = ['아침', '간식1', '점심', '간식2', '저녁']
                    const MEAL_EMOJI: Record<string, string> = {
                        '아침': '🌅', '간식1': '🍪', '점심': '🍱', '간식2': '🧃', '저녁': '🌙',
                    }
                    const dayLogs = [...allDayLogs].sort((a, b) =>
                        MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type)
                    )

                    const hasLogs = dayLogs.length > 0
                    const dimOpacity = !isCurrentMonth

                    days.push(
                        <div
                            key={day.toISOString()}
                            onClick={() => onDateClick(cloneDay)}
                            className={`rounded-xl shrink-0 border min-h-[120px] md:min-h-[160px] p-1.5 md:p-2 flex flex-col cursor-pointer transition-all hover:scale-[1.02] active:scale-95
                                ${dimOpacity ? 'text-slate-300 dark:text-slate-600 bg-transparent border-transparent' :
                                    isSelected ? 'bg-primary/10 border-primary shadow-sm ring-1 ring-primary/50' :
                                        'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-primary/30 shadow-sm'}`}
                        >
                            <span className={`text-xs md:text-sm font-bold mb-1 ml-0.5 ${isSelected ? 'text-primary' : (dimOpacity ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200')}`}>
                                {formattedDate}
                            </span>

                            {hasLogs && (
                                <div className="flex flex-col gap-0.5 md:gap-1 mt-0.5">
                                    {dayLogs.map((log, idx) => {
                                        let chipBg = "bg-primary/15"
                                        if (log.satisfaction === 4) chipBg = "bg-blue-400/15"
                                        if (log.satisfaction === 2) chipBg = "bg-amber-400/15"
                                        if (log.satisfaction === 1) chipBg = "bg-red-400/15"
                                        const emoji = MEAL_EMOJI[log.meal_type] ?? '🍽️'
                                        const menuText = log.meal_items && log.meal_items.length > 0
                                            ? log.meal_items.map(i => i.name).filter(Boolean).join(' · ')
                                            : log.meal_name || log.meal_type

                                        return (
                                            <div
                                                key={idx}
                                                title={menuText}
                                                className={`text-[9px] md:text-[10px] font-semibold px-1 md:px-1.5 py-0.5 rounded md:rounded-md leading-tight text-slate-900 dark:text-slate-100 overflow-hidden ${chipBg}`}
                                                style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}
                                            >
                                                <span className="md:inline hidden">{emoji}</span> {menuText}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                    day = addDays(day, 1)
                }
                rows.push(
                    <div className="grid grid-cols-7 gap-1 md:gap-2" key={day.toISOString()}>
                        {days}
                    </div>
                )
                days = []
            }
            return <div className={`flex flex-col gap-1 md:gap-2 flex-1 relative min-h-[500px]`}>{rows}</div>
        }
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-4 md:p-8 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            {renderHeader()}
            {renderDays()}
            {isLoading && logs.length === 0 ? (
                <div className={`flex flex-col items-center justify-center ${viewMode === 'month' ? 'min-h-[500px]' : 'min-h-[160px]'}`}>
                    <span className="material-symbols-outlined text-primary text-4xl animate-spin delay-150">refresh</span>
                </div>
            ) : (
                renderCells()
            )}
        </div>
    )
}
