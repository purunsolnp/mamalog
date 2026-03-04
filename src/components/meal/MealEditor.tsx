"use client"

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { saveMealLog, updateMealLog } from '@/lib/api'
import { format } from 'date-fns'
import { MealItem, MealLog } from '@/types/database.types'

const SATISFACTION_OPTIONS = [
    { value: 5, label: '다 먹음', icon: 'sentiment_very_satisfied', color: 'bg-primary text-white shadow-primary/30' },
    { value: 4, label: '반쯤', icon: 'sentiment_satisfied', color: 'bg-blue-400 text-white shadow-blue-400/30' },
    { value: 2, label: '조금', icon: 'sentiment_neutral', color: 'bg-amber-400 text-white shadow-amber-400/30' },
    { value: 1, label: '거의 안', icon: 'sentiment_dissatisfied', color: 'bg-red-400 text-white shadow-red-400/30' },
]

const NUTRITION_OPTIONS = [
    { key: 'carbs', label: '탄수화물', icon: 'bakery_dining', color: 'orange' },
    { key: 'protein', label: '단백질', icon: 'kebab_dining', color: 'red' },
    { key: 'fat', label: '지방', icon: 'nutrition', color: 'yellow' },
    { key: 'vitamins', label: '비타민', icon: 'crop', color: 'green' },
] as const

const COLORS = {
    orange: { bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20', dot: 'bg-orange-500', empty: 'bg-orange-200 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-300', icon: 'text-orange-500' },
    red: { bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20', dot: 'bg-red-500', empty: 'bg-red-200 dark:bg-red-900', text: 'text-red-800 dark:text-red-300', icon: 'text-red-500' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-500/10', border: 'border-yellow-200 dark:border-yellow-500/20', dot: 'bg-yellow-500', empty: 'bg-yellow-200 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-300', icon: 'text-yellow-600' },
    green: { bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/20', dot: 'bg-green-500', empty: 'bg-green-200 dark:bg-green-900', text: 'text-green-800 dark:text-green-300', icon: 'text-green-500' },
}

function createEmptyItem(): MealItem {
    return { name: '', ingredients: [], satisfaction: 5 }
}

export function MealEditor() {
    const {
        user, selectedDate, selectedMealType,
        logs, setLogs,
        currentNutrition, setCurrentNutrition,
        currentBaby,
        setEditorOpen,
        editingLog, setEditingLog
    } = useAppStore()

    const [items, setItems] = useState<MealItem[]>([createEmptyItem()])
    // ref 방식으로 재료 입력 관리 (상태 동기화 타이밍 문제 제거)
    const ingredientRefs = useRef<(HTMLInputElement | null)[]>([])
    const [noteText, setNoteText] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    // Populate data if editing
    useEffect(() => {
        if (editingLog) {
            setItems(editingLog.meal_items || [createEmptyItem()])
            setNoteText(editingLog.note_text || '')
            setCurrentNutrition(editingLog.nutrition)
        } else {
            // Reset to defaults if not editing
            setItems([createEmptyItem()])
            setNoteText('')
            setCurrentNutrition({ carbs: 3, protein: 2, fat: 1, vitamins: 2 })
        }
        // ref 입력값 전체 초기화
        ingredientRefs.current.forEach(r => { if (r) r.value = '' })
    }, [editingLog, setCurrentNutrition])

    // -- Item helpers --
    const addItem = () => {
        setItems(prev => [...prev, createEmptyItem()])
    }

    const removeItem = (idx: number) => {
        setItems(prev => prev.filter((_, i) => i !== idx))
        // 해당 ref 제거
        ingredientRefs.current.splice(idx, 1)
    }

    const updateItem = (idx: number, patch: Partial<MealItem>) => {
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))
    }

    // ref에서 직접 값을 읽어 재료 추가 (고리안/한국어 IME, 영어 모두 안정적)
    const addIngredientByRef = (idx: number) => {
        const input = ingredientRefs.current[idx]
        if (!input) return
        const val = input.value.trim()
        if (!val) return
        setItems(prev => prev.map((item, i) =>
            i === idx ? { ...item, ingredients: [...item.ingredients, val] } : item
        ))
        input.value = ''
        input.focus()
    }

    const removeIngredient = (itemIdx: number, ingIdx: number) => {
        const ingredient_list = items[itemIdx].ingredients.filter((_, i) => i !== ingIdx)
        updateItem(itemIdx, { ingredients: ingredient_list })
    }

    const handleNutritionClick = (key: typeof NUTRITION_OPTIONS[number]['key']) => {
        setCurrentNutrition({
            ...currentNutrition,
            [key]: currentNutrition[key] < 3 ? currentNutrition[key] + 1 : 1
        })
    }

    // -- Save --
    const handleSave = async () => {
        if (!user) { setSaveError('로그인이 필요합니다.'); return }
        const validItems = items.filter(i => i.name.trim())
        if (validItems.length === 0) { setSaveError('반찬 이름을 최소 1개 입력해 주세요.'); return }

        // 저장 시작 시점에 편집 여부 스냅샷 (비동기 중 상태 변경에 영향 없도록)
        const isEditing = !!editingLog
        const editingLogId = editingLog?.id

        setIsSaving(true)
        setSaveError(null)
        try {
            if (isEditing && editingLogId) {
                const updatedLog = await updateMealLog(editingLogId, {
                    meal_items: validItems,
                    nutrition: currentNutrition,
                    note_text: noteText.trim() || null,
                })
                setLogs(logs.map(l => l.id === updatedLog.id ? updatedLog : l))
            } else {
                const newLog = await saveMealLog({
                    user_id: user.id,
                    baby_id: currentBaby?.id || null,
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    meal_type: selectedMealType,
                    meal_name: null,
                    meal_items: validItems,
                    nutrition: currentNutrition,
                    satisfaction: null,
                    note_text: noteText.trim() || null,
                    handwritten_image_url: null,
                })
                setLogs([newLog, ...logs])
            }
            // editingLog를 즉시 초기화해서 다음 저장이 update로 잘못 분기되는 버그 방지
            setEditingLog(null)
            setSaveSuccess(true)
            setTimeout(() => {
                setSaveSuccess(false)
                setEditorOpen(false)
            }, 800)
        } catch (e: unknown) {
            setSaveError(e instanceof Error ? e.message : '저장에 실패했습니다.')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-8">

            {/* ── Dish Items ── */}
            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">restaurant_menu</span>
                    반찬 목록
                </label>
                <div className="flex flex-col gap-4">
                    {items.map((item, idx) => (
                        <div key={idx} className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 relative group">
                            {items.length > 1 && (
                                <button
                                    onClick={() => removeItem(idx)}
                                    className="absolute top-3 right-3 p-1 text-slate-300 hover:text-red-400 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            )}

                            {/* Name */}
                            <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateItem(idx, { name: e.target.value })}
                                onKeyUp={(e) => {
                                    if (e.key === 'Enter') {
                                        const name = (e.target as HTMLInputElement).value.trim()
                                        if (name) {
                                            // 이름의 각 단어 중 아직 재료에 없는 것만 추가
                                            const existing = items[idx].ingredients
                                            const newWords = name.split(/\s+/).filter(
                                                w => w && !existing.includes(w)
                                            )
                                            if (newWords.length > 0) {
                                                updateItem(idx, { ingredients: [...existing, ...newWords] })
                                            }
                                        }
                                        // 재료 입력칸으로 포커스 이동
                                        ingredientRefs.current[idx]?.focus()
                                    }
                                }}
                                onBlur={(e) => {
                                    const name = e.target.value.trim()
                                    if (name) {
                                        const existing = items[idx].ingredients
                                        const newWords = name.split(/\s+/).filter(
                                            w => w && !existing.includes(w)
                                        )
                                        if (newWords.length > 0) {
                                            updateItem(idx, { ingredients: [...existing, ...newWords] })
                                        }
                                    }
                                }}
                                placeholder={`반찬 이름 (예: 소고기 미음)`}
                                className="w-full bg-transparent border-none p-0 font-bold text-lg text-slate-900 dark:text-white outline-none placeholder:text-slate-300 mb-3"
                            />

                            {/* Ingredients */}
                            <div className="mb-3">
                                <div className="flex flex-wrap gap-1.5 mb-1.5">
                                    {item.ingredients.map((ing, ingIdx) => (
                                        <span key={ingIdx} className="flex items-center gap-1 bg-white dark:bg-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600">
                                            {ing}
                                            <button onClick={() => removeIngredient(idx, ingIdx)} className="text-slate-300 hover:text-red-400">
                                                <span className="material-symbols-outlined text-[10px]">close</span>
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-2 py-1">
                                    <input
                                        ref={(el) => { ingredientRefs.current[idx] = el }}
                                        type="text"
                                        defaultValue=""
                                        onKeyUp={(e) => {
                                            if (e.key === 'Enter') addIngredientByRef(idx)
                                        }}
                                        placeholder="재료 입력 후 엔터 또는 +"
                                        className="flex-1 bg-transparent border-none text-xs outline-none text-slate-600 dark:text-slate-300 placeholder:text-slate-300 min-w-[0]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => addIngredientByRef(idx)}
                                        className="shrink-0 text-primary hover:bg-primary/10 rounded-lg p-0.5 transition-colors"
                                        title="재료 추가"
                                    >
                                        <span className="material-symbols-outlined text-base">add</span>
                                    </button>
                                </div>
                            </div>


                            {/* Satisfaction per dish */}
                            <div className="flex gap-2 mt-1">
                                {SATISFACTION_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => updateItem(idx, { satisfaction: opt.value })}
                                        className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all text-xs font-bold ${item.satisfaction === opt.value
                                            ? `${opt.color} shadow-lg`
                                            : 'bg-white dark:bg-slate-700 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-xl">{opt.icon}</span>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={addItem}
                    className="w-full mt-3 py-3 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary/60 text-primary font-bold flex items-center justify-center gap-2 transition-all hover:bg-primary/5 text-sm"
                >
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    반찬 추가
                </button>
            </div>

            {/* ── Overall Nutrition ── */}
            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">전체 영양소 구성</label>
                <div className="grid grid-cols-4 gap-3">
                    {NUTRITION_OPTIONS.map(({ key, label, icon, color: colorKey }) => {
                        const c = COLORS[colorKey]
                        const level = currentNutrition[key]
                        return (
                            <div
                                key={key}
                                onClick={() => handleNutritionClick(key)}
                                className={`flex flex-col items-center gap-2 p-4 rounded-2xl ${c.bg} border ${c.border} cursor-pointer hover:brightness-95 transition-all select-none`}
                            >
                                <span className={`material-symbols-outlined ${c.icon} text-3xl`}>{icon}</span>
                                <span className={`text-xs font-bold ${c.text}`}>{label}</span>
                                <div className="flex gap-1">
                                    {[1, 2, 3].map(l => (
                                        <div key={l} className={`h-1.5 w-4 rounded-full ${l <= level ? c.dot : c.empty}`} />
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ── Notes ── */}
            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">notes</span>
                    특이사항 및 메모
                </label>
                <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="알레르기 반응, 거부 반응, 새로 먹어본 재료 등을 기록해 주세요"
                    rows={3}
                    className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm placeholder:text-slate-400 resize-none outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
            </div>

            {/* ── Save ── */}
            {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{saveError}</div>
            )}
            <button
                onClick={handleSave}
                disabled={isSaving || saveSuccess}
                className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 shadow-lg ${saveSuccess
                    ? 'bg-green-500 text-white shadow-green-500/30'
                    : 'bg-primary text-slate-900 shadow-primary/30 hover:brightness-105 disabled:opacity-60'
                    }`}
            >
                <span className="material-symbols-outlined text-xl">
                    {saveSuccess ? 'check_circle' : isSaving ? 'hourglass_empty' : 'save'}
                </span>
                {saveSuccess ? '완료!' : isSaving ? '처리 중...' : (editingLog ? '식단 기록 수정' : '식단 기록 저장')}
            </button>
        </div>
    )
}
