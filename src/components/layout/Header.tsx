"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'

export function Header() {
    const pathname = usePathname()
    const { user, setUser, setAuthModalOpen } = useAppStore()
    const [dropdownOpen, setDropdownOpen] = useState(false)

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setDropdownOpen(false)
    }

    return (
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-primary/10 px-6 md:px-20 py-4 bg-white dark:bg-slate-900 sticky top-0 z-30">
            <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-3 text-primary">
                    <div className="size-8 bg-primary/20 rounded-lg flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-2xl">child_care</span>
                    </div>
                    <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-tight">MammaLog</h2>
                </Link>

                {/* Nav — only when logged in */}
                {user && (
                    <nav className="hidden md:flex items-center gap-8">
                        <Link
                            href="/"
                            className={`text-sm font-semibold transition-all pb-1 border-b-2 ${pathname === '/'
                                ? 'text-primary border-primary'
                                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-primary'}`}
                        >
                            대시보드
                        </Link>
                        <Link
                            href="/logs"
                            className={`text-sm font-semibold transition-all pb-1 border-b-2 ${pathname === '/logs'
                                ? 'text-primary border-primary'
                                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-primary'}`}
                        >
                            식단 기록
                        </Link>
                        <Link
                            href="/growth"
                            className={`text-sm font-semibold transition-all pb-1 border-b-2 ${pathname === '/growth'
                                ? 'text-primary border-primary'
                                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-primary'}`}
                        >
                            성장 일기
                        </Link>
                        <Link
                            href="/inventory"
                            className={`text-sm font-semibold transition-all pb-1 border-b-2 ${pathname === '/inventory'
                                ? 'text-primary border-primary'
                                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-primary'}`}
                        >
                            냉장고 관리
                        </Link>
                    </nav>
                )}
            </div>

            <div className="flex flex-1 justify-end gap-3 items-center">
                {user ? (
                    <>
                        {/* Icon buttons */}
                        <div className="hidden sm:flex gap-2">
                            <button className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all">
                                <span className="material-symbols-outlined">calendar_today</span>
                            </button>
                            <button className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all relative">
                                <span className="material-symbols-outlined">notifications</span>
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                            </button>
                        </div>

                        {/* Avatar + Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="flex items-center gap-2.5 ml-1 cursor-pointer"
                            >
                                <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-primary overflow-hidden flex items-center justify-center text-slate-500">
                                    {user.user_metadata?.avatar_url ? (
                                        <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="material-symbols-outlined">person</span>
                                    )}
                                </div>
                                <div className="hidden md:flex flex-col items-start">
                                    <span className="text-sm font-bold leading-tight">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span>
                                    <span className="text-xs text-slate-400">내 계정</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-400 text-base hidden md:block">expand_more</span>
                            </button>

                            {/* Dropdown */}
                            {dropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                                    <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                                            <p className="text-xs text-slate-400">로그인된 계정</p>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{user.email}</p>
                                        </div>
                                        <div className="p-1.5">
                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-medium"
                                            >
                                                <span className="material-symbols-outlined text-lg">logout</span>
                                                로그아웃
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <button
                        onClick={() => setAuthModalOpen(true)}
                        className="ml-2 px-5 py-2.5 bg-primary text-slate-900 text-sm font-bold rounded-xl hover:brightness-105 hover:scale-105 transition-all shadow-md shadow-primary/20"
                    >
                        시작하기
                    </button>
                )}
            </div>
        </header>
    )
}
