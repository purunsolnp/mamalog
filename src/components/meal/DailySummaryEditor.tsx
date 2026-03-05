"use client"

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { saveDailySummary } from '@/lib/api'
import { format } from 'date-fns'

export function DailySummaryEditor() {
    const { user, selectedDate, dailySummaries, setDailySummaries, currentBaby, latestGrowthSummary, setLatestGrowthSummary } = useAppStore()

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const existingSummary = dailySummaries.find(s => s.date === dateStr && s.baby_id === currentBaby?.id)

    const [water, setWater] = useState(existingSummary?.water_ml || 0)
    const [sleep, setSleep] = useState(existingSummary?.sleep_hours || 0)
    const [weight, setWeight] = useState(existingSummary?.weight_kg || 0)
    const [height, setHeight] = useState(existingSummary?.height_cm || 0)
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)

    // Load existing data when date changes or summaries update
    useEffect(() => {
        if (existingSummary) {
            setWater(existingSummary.water_ml)
            setSleep(existingSummary.sleep_hours)
            setWeight(existingSummary.weight_kg || 0)
            setHeight(existingSummary.height_cm || 0)
        } else {
            setWater(0)
            setSleep(0)
            setWeight(0)
            setHeight(0)
        }
    }, [existingSummary, dateStr])

    const handleSave = async () => {
        if (!user) return
        setIsSaving(true)
        try {
            const updated = await saveDailySummary({
                user_id: user.id,
                baby_id: currentBaby?.id || null, // Can be null if No baby selected yet
                date: dateStr,
                water_ml: water,
                sleep_hours: sleep,
                weight_kg: weight > 0 ? weight : null,
                height_cm: height > 0 ? height : null,
                growth_status: existingSummary?.growth_status || '양호함',
                note_text: existingSummary?.note_text || null
            })

            // Update local store
            const otherSummaries = dailySummaries.filter(s => !(s.date === dateStr && s.baby_id === updated.baby_id))
            setDailySummaries([...otherSummaries, updated])

            // Update latest growth summary if this is a more recent or new growth record
            if (updated.weight_kg || updated.height_cm) {
                if (!latestGrowthSummary || updated.date >= latestGrowthSummary.date) {
                    setLatestGrowthSummary(updated)
                }
            }

            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 2000)
        } catch (e) {
            console.error(e)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">monitoring</span>
                일간 수치 기록
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {/* Water Intake */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">수분 섭취 (ml)</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={water || ''}
                            onChange={(e) => setWater(Number(e.target.value))}
                            placeholder="0"
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ml</span>
                    </div>
                </div>

                {/* Sleep Duration */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">수면 (시간)</label>
                    <div className="relative">
                        <input
                            type="number"
                            step="0.5"
                            value={sleep || ''}
                            onChange={(e) => setSleep(Number(e.target.value))}
                            placeholder="0.0"
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs uppercase">hrs</span>
                    </div>
                </div>

                {/* Growth Section (Weight & Height) */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-primary">monitoring</span>
                        <h4 className="font-bold">성장 기록</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">체중 (kg)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={weight || ''}
                                    onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all font-bold"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">kg</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">신장 (cm)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={height || ''}
                                    onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
                                    placeholder="0.0"
                                    className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 focus:border-primary outline-none transition-all font-bold"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">cm</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={handleSave}
                disabled={isSaving}
                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${saveSuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:brightness-110'
                    }`}
            >
                <span className="material-symbols-outlined text-xl">
                    {saveSuccess ? 'check_circle' : isSaving ? 'hourglass_empty' : 'save'}
                </span>
                {saveSuccess ? '기록 완료!' : isSaving ? '저장 중...' : '기록 저장'}
            </button>
        </div>
    )
}
