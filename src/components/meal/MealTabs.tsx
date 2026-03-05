"use client"

import { useAppStore } from '@/lib/store'

export function MealTabs() {
    const { selectedMealType, setMealType } = useAppStore()

    const tabs = [
        { id: '아침', label: '아침', icon: 'wb_twilight' },
        { id: '간식1', label: '간식 1', icon: 'bakery_dining' },
        { id: '점심', label: '점심', icon: 'lunch_dining' },
        { id: '간식2', label: '간식 2', icon: 'cookie' },
        { id: '저녁', label: '저녁', icon: 'dinner_dining' },
    ]

    return (
        <div className="flex overflow-x-auto gap-2 p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl mb-8 no-scrollbar">
            {tabs.map((tab) => {
                const isActive = selectedMealType === tab.id

                return (
                    <button
                        key={tab.id}
                        onClick={() => setMealType(tab.id)}
                        className={`flex-1 min-w-0 py-2.5 px-2 rounded-xl font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all ${isActive
                            ? 'bg-white dark:bg-slate-700 shadow-sm border border-primary text-primary'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
                            }`}
                    >
                        <span className="material-symbols-outlined text-xl sm:text-base">{tab.icon}</span>
                        <span className="text-[10px] sm:text-sm truncate">{tab.label}</span>
                    </button>
                )
            })}
        </div>
    )
}
