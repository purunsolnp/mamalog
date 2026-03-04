"use client"

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { getBabies, saveBaby, deleteBaby } from '@/lib/api'
import { Baby } from '@/types/database.types'

export function ProfileEditor({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const { user, babies, setBabies, currentBaby, setCurrentBaby } = useAppStore()

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingBaby, setEditingBaby] = useState<Baby | null>(null)

    // Form fields
    const [name, setName] = useState('')
    const [birthday, setBirthday] = useState('')
    const [gender, setGender] = useState<'남자' | '여자'>('남자')
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (isOpen && user) {
            refreshBabies()
        }
    }, [isOpen, user])

    const refreshBabies = async () => {
        if (!user) return
        try {
            const data = await getBabies(user.id)
            setBabies(data)
            // If no current baby, set the first one
            if (!currentBaby && data.length > 0) {
                setCurrentBaby(data[0])
            }
        } catch (e) {
            console.error(e)
        }
    }

    const handleOpenForm = (baby?: Baby) => {
        if (baby) {
            setEditingBaby(baby)
            setName(baby.name)
            setBirthday(baby.birthday)
            setGender(baby.gender)
        } else {
            setEditingBaby(null)
            setName('')
            setBirthday('')
            setGender('남자')
        }
        setIsFormOpen(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        setIsLoading(true)
        try {
            const result = await saveBaby({
                id: editingBaby?.id,
                user_id: user.id,
                name,
                birthday,
                gender
            })

            // Update local state
            await refreshBabies()

            // Always select the created or updated baby
            setCurrentBaby(result)

            setIsFormOpen(false)
        } catch (e) {
            console.error(e)
            alert('저장 중 오류가 발생했습니다.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까? 관련 데이터가 모두 삭제될 수 있습니다.')) return

        try {
            await deleteBaby(id)
            await refreshBabies()
            if (currentBaby?.id === id) {
                setCurrentBaby(babies.find(b => b.id !== id) || null)
            }
        } catch (e) {
            console.error(e)
            alert('삭제 중 오류가 발생했습니다.')
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined">child_care</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black">아이 프로필 관리</h2>
                            <p className="text-xs text-slate-500">다자녀 정보를 관리할 수 있습니다</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {!isFormOpen ? (
                    <div className="flex flex-col gap-4">
                        {/* Baby List */}
                        <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
                            {babies.length > 0 ? babies.map((baby) => (
                                <div
                                    key={baby.id}
                                    className={`group flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${currentBaby?.id === baby.id
                                        ? 'border-primary bg-primary/5'
                                        : 'border-slate-50 dark:border-slate-800 hover:border-slate-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setCurrentBaby(baby)}>
                                        <div className={`size-10 rounded-full flex items-center justify-center font-bold ${baby.gender === '남자' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                                            }`}>
                                            {baby.name[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">{baby.name}</p>
                                            <p className="text-xs text-slate-400">{baby.birthday} • {baby.gender}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenForm(baby)}
                                            className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-white rounded-lg"
                                        >
                                            <span className="material-symbols-outlined text-lg">edit</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(baby.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-white rounded-lg"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-12 text-center text-slate-400">
                                    <span className="material-symbols-outlined text-5xl mb-2">person_off</span>
                                    <p>등록된 아이 정보가 없습니다</p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => handleOpenForm()}
                            className="w-full py-4 rounded-2xl border-2 border-dashed border-primary/40 hover:border-primary text-primary font-bold flex items-center justify-center gap-2 transition-all hover:bg-primary/5 mt-2"
                        >
                            <span className="material-symbols-outlined">add_circle</span>
                            신규 프로필 추가
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full py-4 mt-2 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all text-sm"
                        >
                            닫기
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-200">
                        <div className="flex items-center gap-2 mb-2">
                            <button
                                type="button"
                                onClick={() => setIsFormOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            >
                                <span className="material-symbols-outlined">arrow_back</span>
                            </button>
                            <h3 className="font-bold text-lg">{editingBaby ? '프로필 수정' : '신규 프로필'}</h3>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">아이 이름</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="이름을 입력하세요"
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm focus:ring-2 focus:ring-primary/50 outline-none transition"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">생년월일</label>
                            <input
                                type="date"
                                value={birthday}
                                onChange={(e) => setBirthday(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm focus:ring-2 focus:ring-primary/50 outline-none transition"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">성별</label>
                            <div className="flex gap-2">
                                {(['남자', '여자'] as const).map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => setGender(g)}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border ${gender === g
                                            ? 'bg-primary/10 border-primary text-primary'
                                            : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500'
                                            }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setIsFormOpen(false)}
                                className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:brightness-105 active:scale-95 transition-all text-sm"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-[2] py-4 rounded-2xl bg-primary text-slate-900 font-bold shadow-lg shadow-primary/20 hover:brightness-105 active:scale-95 transition-all text-sm disabled:opacity-50"
                            >
                                {isLoading ? '저장 중...' : '저장하기'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
