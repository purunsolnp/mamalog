"use client"

import { useState } from 'react'
import { MealLog } from '@/types/database.types'
import { deleteMealLog, updateMealLog } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { MealEditor } from './MealEditor'

const SAT_MAP: Record<number, { icon: string; label: string; color: string; activeBg: string }> = {
    5: { icon: 'sentiment_very_satisfied', label: '다 먹음', color: 'text-primary', activeBg: 'bg-primary/10' },
    4: { icon: 'sentiment_satisfied', label: '반쯤 먹음', color: 'text-blue-400', activeBg: 'bg-blue-400/10' },
    2: { icon: 'sentiment_dissatisfied', label: '조금 먹음', color: 'text-amber-400', activeBg: 'bg-amber-400/10' },
    1: { icon: 'sentiment_very_dissatisfied', label: '거의 안', color: 'text-red-400', activeBg: 'bg-red-400/10' },
    0: { icon: 'sentiment_neutral', label: '평가 없음', color: 'text-slate-400', activeBg: 'bg-slate-100' },
}

const MEAL_TYPE_ICON: Record<string, string> = {
    '아침': 'wb_twilight',
    '간식1': 'bakery_dining',
    '점심': 'lunch_dining',
    '간식2': 'cookie',
    '저녁': 'dinner_dining',
}

export function MealLogCard({ log }: { log: MealLog }) {
    const { logs, setLogs, editingLog, setEditingLog, setEditorOpen, setDate, setMealType } = useAppStore()
    const [isExpanded, setIsExpanded] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isWrapping, setIsWrapping] = useState(false)
    const [isQuickEvalOpen, setIsQuickEvalOpen] = useState(false)

    const isEditing = editingLog?.id === log.id

    const hasItems = log.meal_items && log.meal_items.length > 0
    const mealIcon = MEAL_TYPE_ICON[log.meal_type] ?? 'restaurant'

    // Build a summary label for the card collapsed view
    const titleText = hasItems
        ? log.meal_items!.map(i => i.name).filter(Boolean).join(' · ')
        : log.meal_name || '(이름 없음)'

    // Best satisfaction across items (for the icon in collapsed view)
    const overallSat = hasItems
        ? log.meal_items!.reduce((best, item) => item.satisfaction > best ? item.satisfaction : best, 0)
        : (log.satisfaction ?? 0)

    const satInfo = SAT_MAP[overallSat] ?? SAT_MAP[0]

    const handleDelete = async () => {
        if (!confirm(`"${titleText}" 기록을 삭제할까요?`)) return
        setIsDeleting(true)
        try {
            await deleteMealLog(log.id)
            setLogs(logs.filter(l => l.id !== log.id))
        } catch {
            alert('삭제에 실패했습니다.')
        } finally {
            setIsDeleting(false)
        }
    }

    const handleEdit = () => {
        setEditingLog(log)
        setDate(new Date(log.date))
        setMealType(log.meal_type)
        setIsExpanded(true)
        // setEditorOpen(true) <- No longer opening global editor for existing logs
    }

    const handleQuickSat = async (satValue: number) => {
        try {
            const updatedItems = hasItems
                ? log.meal_items!.map(item => ({ ...item, satisfaction: satValue }))
                : log.meal_items

            await updateMealLog(log.id, {
                satisfaction: hasItems ? null : satValue,
                meal_items: updatedItems
            })

            // Update local state
            setLogs(logs.map(l => l.id === log.id ? { ...l, satisfaction: hasItems ? null : satValue, meal_items: updatedItems } : l))
            setIsQuickEvalOpen(false)
        } catch {
            alert('평가 수정에 실패했습니다.')
        }
    }

    return (
        <div className={`bg-slate-50 dark:bg-slate-800/60 rounded-2xl border transition-all relative ${isExpanded ? 'border-primary/30 bg-white dark:bg-slate-800 z-10' : 'border-slate-100 dark:border-slate-700 hover:border-primary/20 hover:z-10'
            }`}>

            {/* ── Collapsed Row ── */}
            <div
                className="group flex items-center gap-4 p-4 cursor-pointer"
                onClick={() => setIsExpanded(v => !v)}
            >
                {/* Meal type icon */}
                <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined">{mealIcon}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{log.meal_type}</span>
                        <h4 className={`font-bold text-slate-900 dark:text-slate-100 ${isWrapping ? 'whitespace-normal break-words' : 'truncate'}`}>{titleText}</h4>
                        {/* Wrap toggle */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsWrapping(v => !v) }}
                            className="shrink-0 text-slate-300 hover:text-primary transition-colors"
                            title={isWrapping ? '한 줄로 보기' : '전체 내용 보기'}
                        >
                            <span className="material-symbols-outlined text-sm">{isWrapping ? 'wrap_text' : 'text_fields'}</span>
                        </button>
                    </div>
                    {/* Item count or note */}
                    <p className="text-xs text-slate-400 mt-0.5">
                        {hasItems
                            ? `${log.meal_items!.length}가지 반찬`
                            : (log.note_text || '메모 없음')}
                    </p>
                </div>

                {/* Satisfaction badge */}
                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsQuickEvalOpen(v => !v) }}
                        className={`flex items-center gap-1 shrink-0 p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all ${satInfo.color}`}
                    >
                        <span className="material-symbols-outlined text-lg">{satInfo.icon}</span>
                        <span className="text-xs font-semibold hidden sm:block">{satInfo.label}</span>
                    </button>

                    {isQuickEvalOpen && (
                        <div
                            className="absolute bottom-full right-0 mb-2 p-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 flex gap-1 animate-in fade-in slide-in-from-bottom-2"
                            onClick={e => e.stopPropagation()}
                        >
                            {[5, 4, 2, 1, 0].map(val => (
                                <button
                                    key={val}
                                    onClick={() => handleQuickSat(val)}
                                    className={`size-10 rounded-xl flex items-center justify-center transition-all ${SAT_MAP[val].activeBg} ${SAT_MAP[val].color} hover:scale-110`}
                                    title={SAT_MAP[val].label}
                                >
                                    <span className="material-symbols-outlined">{SAT_MAP[val].icon}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={handleEdit}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-xl transition-colors"
                        title="수정"
                    >
                        <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        title="삭제"
                    >
                        <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>

                {/* Expand chevron */}
                <span className={`material-symbols-outlined text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </div>

            {/* ── Expanded Detail ── */}
            {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 pt-4 flex flex-col gap-3">

                    {isEditing ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-primary/20 shadow-inner">
                            <MealEditor />
                        </div>
                    ) : (
                        <>
                            {hasItems ? (
                                /* New format: per-dish items */
                                log.meal_items!.map((item, idx) => {
                                    const s = SAT_MAP[item.satisfaction] ?? SAT_MAP[0]
                                    return (
                                        <div key={idx} className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                                            <div className={`size-8 rounded-full shrink-0 flex items-center justify-center ${s.activeBg} ${s.color}`}>
                                                <span className="material-symbols-outlined text-base">{s.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">{item.name}</p>
                                                {item.ingredients.length > 0 && (
                                                    <p className="text-xs text-slate-400 mt-0.5">{item.ingredients.join(', ')}</p>
                                                )}
                                            </div>
                                            <span className={`text-xs font-bold shrink-0 ${s.color}`}>{s.label}</span>
                                        </div>
                                    )
                                })
                            ) : (
                                /* Legacy format: single meal_name + satisfaction */
                                <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <span className={`material-symbols-outlined text-xl ${satInfo.color}`}>{satInfo.icon}</span>
                                    <div>
                                        <p className="font-bold text-sm">{log.meal_name || '(이름 없음)'}</p>
                                        <p className="text-xs text-slate-400">{satInfo.label}</p>
                                    </div>
                                </div>
                            )}

                            {/* Nutrition */}
                            {log.nutrition && (
                                <div className="flex gap-2 mt-1 flex-wrap">
                                    {[
                                        { key: 'carbs', label: '탄수', color: 'bg-orange-100 text-orange-600' },
                                        { key: 'protein', label: '단백', color: 'bg-red-100 text-red-600' },
                                        { key: 'fat', label: '지방', color: 'bg-yellow-100 text-yellow-600' },
                                        { key: 'vitamins', label: '비타민', color: 'bg-green-100 text-green-600' },
                                    ].map(({ key, label, color }) => {
                                        const val = (log.nutrition as Record<string, number>)[key] ?? 0
                                        return (
                                            <span key={key} className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${color}`}>
                                                {label} {'●'.repeat(val)}{'○'.repeat(Math.max(0, 3 - val))}
                                            </span>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Note */}
                            {log.note_text && (
                                <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 leading-relaxed">
                                    💬 {log.note_text}
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
