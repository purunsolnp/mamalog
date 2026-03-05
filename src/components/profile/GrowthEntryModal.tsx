"use client"

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { saveDailySummary } from '@/lib/api'
import { format } from 'date-fns'

interface GrowthEntryModalProps {
    isOpen: boolean
    onClose: () => void
}

export function GrowthEntryModal({ isOpen, onClose }: GrowthEntryModalProps) {
    const { user, selectedDate, dailySummaries, setDailySummaries, currentBaby, latestGrowthSummary, setLatestGrowthSummary } = useAppStore()

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const existingSummary = dailySummaries.find(s => s.date === dateStr && s.baby_id === currentBaby?.id)

    const [weight, setWeight] = useState(existingSummary?.weight_kg || 0)
    const [height, setHeight] = useState(existingSummary?.height_cm || 0)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (isOpen && existingSummary) {
            setWeight(existingSummary.weight_kg || 0)
            setHeight(existingSummary.height_cm || 0)
        } else if (isOpen) {
            setWeight(0)
            setHeight(0)
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
                date: dateStr,
                water_ml: existingSummary?.water_ml || 0,
                sleep_hours: existingSummary?.sleep_hours || 0,
                weight_kg: weight > 0 ? weight : null,
                height_cm: height > 0 ? height : null,
                growth_status: existingSummary?.growth_status || '양호함',
                note_text: existingSummary?.note_text || null
            })

            const otherSummaries = dailySummaries.filter(s => !(s.date === dateStr && s.baby_id === updated.baby_id))
            setDailySummaries([...otherSummaries, updated])

            if (updated.weight_kg || updated.height_cm) {
                if (!latestGrowthSummary || updated.date >= latestGrowthSummary.date) {
                    setLatestGrowthSummary(updated)
                }
            }
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
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-3xl">monitoring</span>
                            우리아이 성장 기록
                        </h3>
                        <p className="text-sm text-slate-400 font-bold mt-1">체중과 신장을 입력하여 성장을 추적하세요.</p>
                    </div>
                    <button onClick={onClose} className="p-3 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
                        <span className="material-symbols-outlined text-2xl font-black">close</span>
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Weight */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">체중 (KG)</label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={weight || ''}
                                    onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-5 text-2xl font-black text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-slate-200"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg">KG</span>
                            </div>
                        </div>

                        {/* Height */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">신장 (CM)</label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={height || ''}
                                    onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
                                    placeholder="0.0"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-5 text-2xl font-black text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-slate-200"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg uppercase">CM</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full py-5 rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-lg font-black shadow-xl shadow-slate-900/20 dark:shadow-white/10 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
                    >
                        {isSaving ? (
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined">save</span>
                        )}
                        {isSaving ? '저장 중...' : '기록 저장'}
                    </button>
                </div>
            </div>
        </div>
    )
}
