"use client"

import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { calculateExactPercentile, describePercentile } from '@/lib/growth'
import { differenceInMonths } from 'date-fns'

type Props = {
    isOpen: boolean
    onClose: () => void
}

export function GrowthDetailModal({ isOpen, onClose }: Props) {
    const { currentBaby, currentBaby: baby, growthCharts, dailySummaries } = useAppStore()

    // Find the most recent summary that has weight/height
    const latestRecord = useMemo(() => {
        return dailySummaries
            .filter(s => s.weight_kg || s.height_cm)
            .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
    }, [dailySummaries])

    const ageMonths = baby ? differenceInMonths(new Date(), new Date(baby.birthday)) : null
    const ageDisplay = ageMonths != null
        ? ageMonths >= 12
            ? `${Math.floor(ageMonths / 12)}세 ${ageMonths % 12}개월`
            : `${ageMonths}개월`
        : null

    const gender = baby?.gender ?? '남자'

    // Weight-for-height percentile
    const wh = useMemo(() => {
        if (!latestRecord?.weight_kg || !latestRecord?.height_cm) return null
        const chart = growthCharts.filter(c => c.type === 'weight_height' && c.gender === gender)
        if (chart.length === 0) return null
        const pct = calculateExactPercentile(chart, latestRecord.height_cm!, latestRecord.weight_kg!)
        return { pct, info: describePercentile(pct) }
    }, [latestRecord, growthCharts, gender])

    // Weight-for-age percentile
    const wa = useMemo(() => {
        if (!latestRecord?.weight_kg || ageMonths == null) return null
        const chart = growthCharts.filter(c => c.type === 'weight_age' && c.gender === gender)
        if (chart.length === 0) return null
        const pct = calculateExactPercentile(chart, ageMonths, latestRecord.weight_kg!)
        return { pct, info: describePercentile(pct) }
    }, [latestRecord, ageMonths, growthCharts, gender])

    // Height-for-age percentile
    const ha = useMemo(() => {
        if (!latestRecord?.height_cm || ageMonths == null) return null
        const chart = growthCharts.filter(c => c.type === 'height_age' && c.gender === gender)
        if (chart.length === 0) return null
        const pct = calculateExactPercentile(chart, ageMonths, latestRecord.height_cm!)
        return { pct, info: describePercentile(pct) }
    }, [latestRecord, ageMonths, growthCharts, gender])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined">monitoring</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black">성장 분석</h2>
                            {baby && (
                                <p className="text-xs text-slate-500">
                                    {baby.name} · {ageDisplay} · {gender === '남자' ? '남아' : '여아'}
                                </p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {!baby ? (
                    <p className="text-center text-slate-400 py-8">아이 프로필을 먼저 설정해 주세요</p>
                ) : !latestRecord ? (
                    <p className="text-center text-slate-400 py-8">
                        <span className="material-symbols-outlined text-4xl block mb-2">scale</span>
                        체중/신장 기록이 없어요<br />
                        <span className="text-xs mt-1 block">식단 기록 모달에서 &ldquo;일간 수치 기록&rdquo;에 입력하세요</span>
                    </p>
                ) : (
                    <div className="flex flex-col gap-4">
                        {/* Record Source */}
                        <div className="text-xs text-slate-400 font-bold text-center">
                            📅 {latestRecord.date} 기준
                            {latestRecord.weight_kg && ` · ${latestRecord.weight_kg}kg`}
                            {latestRecord.height_cm && ` · ${latestRecord.height_cm}cm`}
                        </div>

                        {/* Weight for Height */}
                        {wh && (
                            <PercentileCard
                                title="신장 대비 체중"
                                subtitle={`신장 ${latestRecord.height_cm}cm에서 체중 ${latestRecord.weight_kg}kg`}
                                pct={wh.pct}
                                info={wh.info}
                                recommended
                            />
                        )}

                        {/* Weight for Age */}
                        {wa && (
                            <PercentileCard
                                title="연령 대비 체중"
                                subtitle={`${ageDisplay}에서 체중 ${latestRecord.weight_kg}kg`}
                                pct={wa.pct}
                                info={wa.info}
                            />
                        )}

                        {/* Height for Age */}
                        {ha && (
                            <PercentileCard
                                title="연령 대비 신장"
                                subtitle={`${ageDisplay}에서 신장 ${latestRecord.height_cm}cm`}
                                pct={ha.pct}
                                info={ha.info}
                            />
                        )}

                        {/* Legend */}
                        <div className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 leading-relaxed">
                            <p className="font-bold text-slate-500 mb-1">백분위(퍼센타일)란?</p>
                            같은 나이·성별 100명 중 몇 번째인지를 나타냅니다.
                            3~97 사이면 정상 범위입니다.
                            <br />표시 값은 선형 보간법(Linear Interpolation)으로 추정한 값입니다.
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function PercentileCard({
    title, subtitle, pct, info, recommended
}: {
    title: string
    subtitle: string
    pct: number
    info: ReturnType<typeof describePercentile>
    recommended?: boolean
}) {
    const pctRounded = Math.round(pct * 10) / 10
    const barWidth = Math.max(2, Math.min(100, pct))

    // Color for the bar
    const barColor = pct < 3 || pct > 97
        ? 'bg-red-400'
        : pct < 10 || pct > 90
            ? 'bg-amber-400'
            : pct < 25 || pct > 75
                ? 'bg-blue-400'
                : 'bg-primary'

    return (
        <div className={`rounded-2xl border p-5 ${recommended ? 'border-primary/30 bg-primary/3' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'}`}>

            <div className="flex items-start justify-between mb-3">
                <div>
                    <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{title}</p>
                        {recommended && (
                            <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">권장</span>
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                    <p className={`text-2xl font-black ${info.color}`}>{pctRounded}<span className="text-sm font-bold">th</span></p>
                    <p className="text-[10px] text-slate-400">백분위</p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-visible mb-3">
                {/* Normal range shading */}
                <div
                    className="absolute h-full bg-primary/10 rounded-full"
                    style={{ left: '25%', width: '50%' }}
                />
                {/* Bar */}
                <div
                    className={`absolute h-full ${barColor} rounded-full transition-all duration-700`}
                    style={{ width: `${barWidth}%` }}
                />
                {/* Current position dot */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 size-4 rounded-full bg-white border-2 border-current shadow-md transition-all duration-700"
                    style={{ left: `calc(${barWidth}% - 8px)` }}
                />
                {/* Tick marks for p25 / p75 */}
                <div className="absolute left-[25%] top-0 h-full w-px bg-slate-300 dark:bg-slate-600" />
                <div className="absolute left-[75%] top-0 h-full w-px bg-slate-300 dark:bg-slate-600" />
                <div className="absolute left-[50%] top-0 h-full w-0.5 bg-slate-400 dark:bg-slate-500" />
            </div>

            {/* Scale labels */}
            <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-2">
                <span>3rd</span>
                <span>25th</span>
                <span>50th</span>
                <span>75th</span>
                <span>97th</span>
            </div>

            <p className={`text-xs font-bold ${info.color}`}>{info.emoji} {info.label}</p>
        </div>
    )
}
