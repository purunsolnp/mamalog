"use client"

import { useState, useEffect } from 'react'
import {
    format, addMonths, subMonths, startOfMonth,
    endOfMonth, startOfWeek, endOfWeek, isSameMonth,
    isSameDay, addDays
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { useAppStore } from '@/lib/store'
import { getMealLogs } from '@/lib/api'

export function CalendarDashboard() {
    const { user, selectedDate, setDate, setEditorOpen, logs, setLogs } = useAppStore()
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [isLoading, setIsLoading] = useState(false)

    // Fetch logs when month or user changes
    useEffect(() => {
        if (!user) {
            setLogs([])
            return
        }

        const fetchLogs = async () => {
            setIsLoading(true)
            try {
                const start = startOfMonth(currentMonth)
                const end = endOfMonth(currentMonth)
                const data = await getMealLogs(
                    user.id,
                    format(start, 'yyyy-MM-dd'),
                    format(end, 'yyyy-MM-dd')
                )
                setLogs(data)
            } catch (error) {
                console.error("Failed to load calendar logs", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchLogs()
    }, [user, currentMonth, setLogs])


    const onDateClick = (day: Date) => {
        setDate(day)
        setEditorOpen(true)
    }

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold dark:text-white capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale: ko })}
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                        <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">chevron_left</span>
                    </button>
                    <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                        <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">chevron_right</span>
                    </button>
                </div>
            </div>
        )
    }

    const renderDays = () => {
        const startDate = startOfWeek(currentMonth)
        const days = []
        for (let i = 0; i < 7; i++) {
            days.push(
                <div key={i} className="text-center text-xs font-bold text-slate-400 uppercase">
                    {format(addDays(startDate, i), 'EEE', { locale: ko })}
                </div>
            )
        }
        return <div className="grid grid-cols-7 gap-2 mb-4">{days}</div>
    }

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(monthStart)
        const startDate = startOfWeek(monthStart)
        const endDate = endOfWeek(monthEnd)

        const rows = []
        let days = []
        let day = startDate
        let formattedDate = ""

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, 'd')
                const cloneDay = day
                const isSelected = isSameDay(day, selectedDate)
                const isCurrentMonth = isSameMonth(day, monthStart)
                const dateStr = format(day, 'yyyy-MM-dd')
                const allDayLogs = logs.filter(log => log.date === dateStr)

                // Fixed meal order — sort all logs by it (duplicates allowed)
                const MEAL_ORDER = ['아침', '간식1', '점심', '간식2', '저녁']
                const MEAL_EMOJI: Record<string, string> = {
                    '아침': '🌅',
                    '간식1': '🍪',
                    '점심': '🍱',
                    '간식2': '🧃',
                    '저녁': '🌙',
                }
                const dayLogs = [...allDayLogs].sort((a, b) =>
                    MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type)
                )

                const hasLogs = dayLogs.length > 0

                days.push(
                    <div
                        key={day.toISOString()}
                        onClick={() => onDateClick(cloneDay)}
                        className={`rounded-2xl border min-h-[160px] p-2 flex flex-col cursor-pointer transition-all hover:scale-[1.02] active:scale-95
                            ${!isCurrentMonth ? 'text-slate-300 dark:text-slate-600 bg-transparent border-transparent' :
                                isSelected ? 'bg-primary/10 border-primary shadow-sm' :
                                    'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-primary/30 shadow-sm'}`}
                    >
                        <span className={`text-sm font-bold mb-1 ${isSelected ? 'text-primary' : (isCurrentMonth ? 'text-slate-600 dark:text-slate-300' : '')}`}>
                            {formattedDate}
                        </span>

                        {hasLogs && (
                            <div className="flex flex-col gap-0.5 mt-0.5">
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
                                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md leading-tight text-slate-900 dark:text-slate-100 overflow-hidden ${chipBg}`}
                                            style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}
                                        >
                                            {emoji} {menuText}
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
                <div className="grid grid-cols-7 gap-2" key={day.toISOString()}>
                    {days}
                </div>
            )
            days = []
        }
        return <div className="flex flex-col gap-2 flex-1 relative min-h-[500px]">{rows}</div>
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
            {renderHeader()}
            {renderDays()}
            {isLoading ? (
                <div className="flex-1 min-h-[500px] flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-4xl animate-spin delay-150">refresh</span>
                </div>
            ) : (
                renderCells()
            )}
        </div>
    )
}
