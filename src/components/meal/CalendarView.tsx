"use client"

import { useState } from 'react'

export function CalendarView() {
    const [currentDate, setCurrentDate] = useState(new Date())

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-full min-h-[500px]">

            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold dark:text-white">October 2023</h2>
                <div className="flex gap-2">
                    <button className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition" aria-label="Previous Month">
                        <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">chevron_left</span>
                    </button>
                    <button className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition" aria-label="Next Month">
                        <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">chevron_right</span>
                    </button>
                </div>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 gap-2 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid (Placeholder for actual dates) */}
            <div className="grid grid-cols-7 gap-2 flex-1 relative">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <span className="material-symbols-outlined text-8xl text-slate-300 dark:text-slate-600">construction</span>
                </div>
                {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className={`rounded-2xl border border-slate-100 dark:border-slate-800 p-2 min-h-[80px] flex flex-col ${i === 24 ? 'bg-primary/10 border-primary/50' : 'bg-slate-50 dark:bg-slate-800/20'}`}>
                        <span className={`text-sm font-semibold mb-1 ${i === 24 ? 'text-primary' : 'text-slate-500'}`}>
                            {(i % 31) + 1}
                        </span>

                        {/* Mock data indicators */}
                        {i % 5 === 0 && (
                            <div className="flex gap-1 mt-auto">
                                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

        </div>
    )
}
