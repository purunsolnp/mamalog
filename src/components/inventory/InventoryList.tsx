"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { differenceInDays } from 'date-fns'

export function InventoryList() {
    const { user, inventories, setInventories } = useAppStore()
    const [isLoading, setIsLoading] = useState(true)

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

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 h-[500px] flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span>
            </div>
        )
    }

    if (inventories.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 h-[500px] flex items-center justify-center flex-col">
                <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">kitchen</span>
                <h3 className="text-xl font-bold text-slate-400 mb-2">냉장고가 비어있어요</h3>
                <p className="text-sm text-slate-500">새로운 식재료를 추가해보세요.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

                return (
                    <div key={item.id} className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 relative group overflow-hidden">
                        <button
                            onClick={() => handleDelete(item.id)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 rounded-full p-1 shadow-sm border border-slate-200 dark:border-slate-700 z-10"
                        >
                            <span className="material-symbols-outlined text-lg block">delete</span>
                        </button>

                        <div className="flex items-start justify-between mb-4">
                            <div className={`p-3 rounded-2xl flex items-center justify-center ${badgeClass}`}>
                                <span className="material-symbols-outlined">kitchen</span>
                            </div>
                            {item.expiry_date && (
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">유통기한</p>
                                    <p className={`text-sm ${expiryColor}`}>
                                        {daysLeft !== null && daysLeft < 0 ? `D+${Math.abs(daysLeft)} (지남)` : `D-${daysLeft}`}
                                    </p>
                                </div>
                            )}
                        </div>

                        <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1 truncate">{item.ingredient_name.split(' (')[0]}</h4>
                        {item.ingredient_name.includes('(') && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                {item.ingredient_name.substring(item.ingredient_name.indexOf('(') + 1, item.ingredient_name.lastIndexOf(')'))}
                            </p>
                        )}
                        {!item.ingredient_name.includes('(') && <p className="text-sm text-slate-500 dark:text-slate-400 h-5"></p>}

                    </div>
                )
            })}
        </div>
    )
}
