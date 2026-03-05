"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { differenceInDays } from 'date-fns'
import { Inventory } from '@/types/database.types'
import { InventoryForm } from './InventoryForm'

export function InventoryList() {
    const { user, inventories, setInventories } = useAppStore()
    const [isLoading, setIsLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editNote, setEditNote] = useState('')
    const [editExpiry, setEditExpiry] = useState('')
    const [editStockStatus, setEditStockStatus] = useState<'enough' | 'low' | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)

    useEffect(() => {
        const fetchInventory = async () => {
            if (!user) {
                setIsLoading(false)
                return
            }
            const { data, error } = await supabase
                .from('inventory')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (!error && data) setInventories(data)
            setIsLoading(false)
        }
        fetchInventory()
    }, [user, setInventories])

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from('inventory').delete().eq('id', id)
        if (!error) {
            setInventories(inventories.filter((item) => item.id !== id))
        }
    }

    const startEdit = (item: Inventory) => {
        setEditingId(item.id)
        const rawName = item.ingredient_name.split(' (')[0].trim()
        const rawNote = item.ingredient_name.includes('(')
            ? item.ingredient_name.substring(item.ingredient_name.indexOf('(') + 1, item.ingredient_name.lastIndexOf(')'))
            : ''
        setEditName(rawName)
        setEditNote(rawNote)
        setEditExpiry(item.expiry_date ?? '')
        setEditStockStatus(item.stock_status ?? 'enough')
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditName('')
        setEditNote('')
        setEditExpiry('')
        setEditStockStatus(null)
    }

    const handleSave = async (item: Inventory) => {
        if (!editName.trim()) return
        setIsSaving(true)
        const newIngredientName = editNote.trim() ? `${editName.trim()} (${editNote.trim()})` : editName.trim()
        const { data, error } = await supabase
            .from('inventory')
            .update({
                ingredient_name: newIngredientName,
                expiry_date: editExpiry || null,
                stock_status: editStockStatus
            })
            .eq('id', item.id)
            .select()
            .single()

        if (!error && data) {
            setInventories(inventories.map(i => i.id === data.id ? data : i))
            cancelEdit()
        }
        setIsSaving(false)
    }

    const toggleStockStatus = async (item: Inventory) => {
        const newStatus = item.stock_status === 'low' ? 'enough' : 'low'
        const { data, error } = await supabase
            .from('inventory')
            .update({ stock_status: newStatus })
            .eq('id', item.id)
            .select()
            .single()

        if (!error && data) {
            setInventories(inventories.map(i => i.id === data.id ? data : i))
        }
    }

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 h-[500px] flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">kitchen</span>
                재료 목록
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inventories.length === 0 && (
                    <div className="col-span-full bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
                        <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-800 mb-4">kitchen</span>
                        <p className="text-slate-400 font-bold">냉장고가 비어있어요.<br />첫 번째 재료를 추가해 보세요!</p>
                    </div>
                )}
                {inventories.map((item) => {
                    let daysLeft = null
                    let expiryColor = 'text-slate-500'
                    let badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'

                    if (item.expiry_date) {
                        daysLeft = differenceInDays(new Date(item.expiry_date), new Date())
                        if (daysLeft < 0) {
                            expiryColor = 'text-red-500 font-bold'
                            badgeClass = 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                        } else if (daysLeft <= 3) {
                            expiryColor = 'text-orange-500 font-bold'
                            badgeClass = 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
                        } else {
                            badgeClass = 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                        }
                    }

                    const isEditing = editingId === item.id

                    return (
                        <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-100 dark:border-slate-800 relative group overflow-hidden">

                            {isEditing ? (
                                /* ── 편집 모드 ── */
                                <div className="flex flex-col gap-3">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">수정 중</p>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">재료명</label>
                                        <input
                                            autoFocus
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
                                            className="w-full px-3 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
                                            placeholder="재료 이름"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">추가 정보</label>
                                        <input
                                            value={editNote}
                                            onChange={e => setEditNote(e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
                                            placeholder="예: 30g 소분 (선택)"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">유통기한</label>
                                        <input
                                            type="date"
                                            value={editExpiry}
                                            onChange={e => setEditExpiry(e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">재고 상태</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setEditStockStatus('enough')}
                                                className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${editStockStatus === 'enough'
                                                    ? 'bg-primary/10 border-primary text-primary'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                                                    }`}
                                            >
                                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                                충분함
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditStockStatus('low')}
                                                className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${editStockStatus === 'low'
                                                    ? 'bg-amber-100 border-amber-500 text-amber-600'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                                                    }`}
                                            >
                                                <span className="material-symbols-outlined text-sm">shopping_cart</span>
                                                모자람
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => handleSave(item)}
                                            disabled={isSaving || !editName.trim()}
                                            className="flex-1 py-2 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:brightness-105 disabled:opacity-50 transition-all flex items-center justify-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-base">{isSaving ? 'hourglass_empty' : 'save'}</span>
                                            저장
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="px-3 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 font-bold text-sm rounded-xl transition-all"
                                        >
                                            취소
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* ── 보기 모드 ── */
                                <>
                                    <div className="flex items-center gap-2 sm:gap-3 w-full">
                                        {/* 작아진 아이콘 */}
                                        <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${badgeClass}`}>
                                            <span className="material-symbols-outlined text-sm sm:text-base">kitchen</span>
                                        </div>

                                        {/* 재료 이름 및 유통기한 */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <div className="flex items-center gap-1 sm:gap-2 overflow-hidden">
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                                    {item.ingredient_name.split(' (')[0]}
                                                </h4>
                                                {item.ingredient_name.includes('(') && (
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate shrink-0">
                                                        {item.ingredient_name.substring(item.ingredient_name.indexOf('(') + 1, item.ingredient_name.lastIndexOf(')'))}
                                                    </span>
                                                )}
                                            </div>
                                            {item.expiry_date && (
                                                <p className={`text-[10px] mt-0.5 font-medium truncate ${expiryColor}`}>
                                                    기한: {daysLeft !== null && daysLeft < 0 ? `지남` : `D-${daysLeft}`}
                                                </p>
                                            )}
                                        </div>

                                        {/* 재고 상태 버튼 */}
                                        <button
                                            onClick={() => toggleStockStatus(item)}
                                            className="shrink-0 transition-transform active:scale-95"
                                            title="상태 변경"
                                        >
                                            {item.stock_status === 'low' ? (
                                                <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-lg border border-amber-200 dark:border-amber-800">
                                                    모자람
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-200 dark:border-emerald-800">
                                                    충분함
                                                </span>
                                            )}
                                        </button>

                                        {/* 액션 버튼 */}
                                        <div className="flex items-center gap-1 shrink-0 ml-1">
                                            <button onClick={() => startEdit(item)} className="p-1 text-slate-400 hover:text-primary transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )
                })}

                {/* Add Item Card Button */}
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center justify-center gap-3 p-4 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 text-slate-300 hover:border-primary/30 hover:text-primary hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group h-[74px]"
                >
                    <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-primary group-hover:text-slate-900 flex items-center justify-center transition-all shrink-0">
                        <span className="material-symbols-outlined text-xl">add</span>
                    </div>
                    <span className="text-sm font-bold">재료 추가하기</span>
                </button>
            </div>

            {/* Add Ingredient Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setIsAddModalOpen(false)}
                            className="absolute top-6 right-6 p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                        <div className="p-8">
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary text-3xl">add_circle</span>
                                새 식재료 추가
                            </h3>
                            <InventoryForm onClose={() => setIsAddModalOpen(false)} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
