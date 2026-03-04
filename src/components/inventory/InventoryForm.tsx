"use client"

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'

export function InventoryForm() {
    const { user, inventories, setInventories } = useAppStore()
    const [name, setName] = useState('')
    const [note, setNote] = useState('') // Optional: Could add note to DB or append to name for now.
    const [expiry, setExpiry] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async () => {
        if (!user || !name.trim()) return

        setIsLoading(true)
        const newIngredient = {
            user_id: user.id,
            ingredient_name: note ? `${name} (${note})` : name,
            expiry_date: expiry || null
        }

        const { data, error } = await supabase
            .from('inventory')
            .insert(newIngredient)
            .select()
            .single()

        if (!error && data) {
            setInventories([data, ...inventories])
            setName('')
            setNote('')
            setExpiry('')
        }
        setIsLoading(false)
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 h-full">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_circle</span>
                새 식재료 추가
            </h3>
            <div className="flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">식재료 이름</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        placeholder="예: 소고기 (안심)"
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">추가 정보</label>
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        placeholder="예: 30g 소분 (선택사항)"
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">유통기한 (선택)</label>
                    <input
                        type="date"
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none transition-all text-slate-500"
                    />
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={isLoading || !name.trim()}
                    className="w-full py-4 mt-4 bg-primary text-slate-900 font-bold rounded-xl hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined">{isLoading ? 'hourglass_empty' : 'save'}</span>
                    {isLoading ? '저장 중...' : '냉장고에 넣기'}
                </button>
            </div>
        </div>
    )
}
