"use client"

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { saveDailySummary } from '@/lib/api'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface DailySummaryModalProps {
    date: string
    isOpen: boolean
    onClose: () => void
}

export function DailySummaryModal({ date, isOpen, onClose }: DailySummaryModalProps) {
    const { user, dailySummaries, setDailySummaries, currentBaby } = useAppStore()

    const existingSummary = dailySummaries.find(s => s.date === date && s.baby_id === currentBaby?.id)

    const [water, setWater] = useState(existingSummary?.water_ml || 0)
    const [sleep, setSleep] = useState(existingSummary?.sleep_hours || 0)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (isOpen && existingSummary) {
            setWater(existingSummary.water_ml || 0)
            setSleep(existingSummary.sleep_hours || 0)
        } else if (isOpen) {
            setWater(0)
            setSleep(0)
        }
    }, [isOpen, existingSummary])

    if (!isOpen) return null

    const handleSave = async () => {
        if (!user) return
        setIsSaving(true)
        try {
            const updated = await saveDailySummary({
                user_id: user.id,
                baby_id: currentBaby?.id || null,
                date: date,
                water_ml: water,
                sleep_hours: sleep,
                weight_kg: existingSummary?.weight_kg || null,
                height_cm: existingSummary?.height_cm || null,
                growth_status: existingSummary?.growth_status || '양호함',
                note_text: existingSummary?.note_text || null
            })

            const otherSummaries = dailySummaries.filter(s => !(s.date === date && s.baby_id === updated.baby_id))
            setDailySummaries([...otherSummaries, updated])
            onClose()
        } catch (e) {
            console.error(e)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                            {format(new Date(date), 'M월 d일 (EEE)', { locale: ko })} 기록
                        </h3>
                        <p className="text-sm text-slate-400 font-bold mt-1">오늘 아기의 수분 섭취와 수면을 기록하세요.</p>
                    </div>
                    <button onClick={onClose} className="p-3 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
                        <span className="material-symbols-outlined text-2xl font-black">close</span>
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 gap-6">
                        {/* Water Intake */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                <span className="material-symbols-outlined text-blue-500 text-lg">water_drop</span>
                                수분 섭취 (ml)
                            </label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    value={water || ''}
                                    onChange={(e) => setWater(Number(e.target.value))}
                                    placeholder="0"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-5 text-2xl font-black text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-slate-200"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg">ML</span>
                            </div>
                        </div>

                        {/* Sleep Duration */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                <span className="material-symbols-outlined text-purple-500 text-lg">bedtime</span>
                                수면 (시간)
                            </label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    step="0.5"
                                    value={sleep || ''}
                                    onChange={(e) => setSleep(Number(e.target.value))}
                                    placeholder="0.0"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-5 text-2xl font-black text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-slate-200"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg uppercase">HRS</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full py-5 rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-lg font-black shadow-xl shadow-slate-900/20 dark:shadow-white/10 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined">save</span>
                        )}
                        {isSaving ? '저장 중...' : '기록 완료'}
                    </button>
                </div>
            </div>
        </div>
    )
}
