"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'

export function Header() {
    const pathname = usePathname()
    const { user, setUser, setAuthModalOpen, babies, currentBaby, setCurrentBaby, setProfileModalOpen } = useAppStore()
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [babyMenuOpen, setBabyMenuOpen] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setDropdownOpen(false)
        setIsMobileMenuOpen(false)
    }

    const ensureHttps = (url: string | undefined | null) => {
        if (!url) return null
        return url.replace('http://', 'https://')
    }

    const navigationLinks = [
        { href: "/", label: "식단 관리", icon: "calendar_month" },
        { href: "/logs", label: "식단 통계", icon: "restaurant" },
        { href: "/inventory", label: "냉장고 관리", icon: "kitchen" },
    ]

    return (
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-primary/10 px-4 md:px-6 lg:px-20 py-4 bg-white dark:bg-slate-900 sticky top-0 z-30">
            <div className="flex items-center gap-4 lg:gap-8">
                {/* Mobile Menu Button */}
                {user && (
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                    >
                        <span className="material-symbols-outlined text-2xl">menu</span>
                    </button>
                )}

                <Link href="/" className="flex items-center gap-2 md:gap-3 text-primary">
                    <div className="size-7 md:size-8 bg-primary/20 rounded-lg flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-xl md:text-2xl">child_care</span>
                    </div>
                    <h2 className="text-slate-900 dark:text-slate-100 text-lg md:text-xl font-bold leading-tight tracking-tight">MammaLog</h2>
                </Link>

                {/* Desktop Nav */}
                {user && (
                    <nav className="hidden md:flex items-center gap-6 lg:gap-8">
                        {navigationLinks.map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`text-sm font-semibold transition-all pb-1 border-b-2 ${pathname === link.href
                                    ? 'text-primary border-primary'
                                    : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-primary'}`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                )}
            </div>

            <div className="flex flex-1 justify-end gap-2 md:gap-3 items-center">
                {user ? (
                    <>
                        <div className="flex gap-1 md:gap-2 items-center">
                            {/* 캘린더/플래너 숏컷 버튼 (데스크탑) */}
                            <Link href="/" className="hidden sm:block p-1.5 md:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all">
                                <span className="material-symbols-outlined text-xl md:text-2xl">calendar_today</span>
                            </Link>

                            {/* 아기 프로필 선택 버튼 (벨 자리 대체) */}
                            <div className="relative">
                                <button
                                    onClick={() => setBabyMenuOpen(v => !v)}
                                    className="flex items-center gap-1.5 p-1.5 md:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all"
                                    title="아기 프로필 선택"
                                >
                                    <span className="material-symbols-outlined text-xl md:text-2xl">child_friendly</span>
                                    {currentBaby && (
                                        <span className="hidden sm:inline text-xs font-bold max-w-[60px] truncate leading-none">
                                            {currentBaby.name}
                                        </span>
                                    )}
                                </button>

                                {babyMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setBabyMenuOpen(false)} />
                                        <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 overflow-hidden">
                                            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">아기 선택</p>
                                            </div>
                                            <div className="p-1.5 flex flex-col gap-0.5">
                                                {babies.length === 0 ? (
                                                    <p className="text-xs text-slate-400 px-3 py-2">등록된 아기가 없어요</p>
                                                ) : (
                                                    babies.map(baby => (
                                                        <button
                                                            key={baby.id}
                                                            onClick={() => { setCurrentBaby(baby); setBabyMenuOpen(false) }}
                                                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${currentBaby?.id === baby.id
                                                                ? 'bg-primary/10 text-primary font-bold'
                                                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                                                                }`}
                                                        >
                                                            <span className="material-symbols-outlined text-base text-primary">face</span>
                                                            {baby.name}
                                                            {currentBaby?.id === baby.id && (
                                                                <span className="material-symbols-outlined text-sm ml-auto text-primary">check</span>
                                                            )}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                            {/* 아기 추가 버튼 */}
                                            <div className="border-t border-slate-100 dark:border-slate-700 p-1.5">
                                                <button
                                                    onClick={() => { setBabyMenuOpen(false); setProfileModalOpen(true) }}
                                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-base">add_circle</span>
                                                    아기 추가 / 관리
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Avatar + Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="flex items-center gap-2.5 ml-1 cursor-pointer"
                            >
                                <div className="size-8 md:size-10 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-primary overflow-hidden flex items-center justify-center text-slate-500">
                                    {user.user_metadata?.avatar_url ? (
                                        <img src={ensureHttps(user.user_metadata.avatar_url)!} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="material-symbols-outlined text-xl">person</span>
                                    )}
                                </div>
                                <div className="hidden md:flex flex-col items-start">
                                    <span className="text-sm font-bold leading-tight truncate max-w-[100px] lg:max-w-[150px]">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span>
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
                        className="ml-2 px-4 py-2 md:px-5 md:py-2.5 bg-primary text-slate-900 text-sm font-bold rounded-xl hover:brightness-105 hover:scale-105 transition-all shadow-md shadow-primary/20"
                    >
                        시작하기
                    </button>
                )}
            </div>

            {/* Mobile Sidebar Navigation */}
            {isMobileMenuOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    <div className="fixed inset-y-0 left-0 w-[280px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out md:hidden flex flex-col">
                        <div className="p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                            <span className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-slate-100">
                                <span className="material-symbols-outlined text-primary text-2xl">child_care</span>
                                MammaLog
                            </span>
                            <button
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* 모바일 사이드바 - 아기 선택 */}
                        {babies.length > 0 && (
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">아기 선택</p>
                                <div className="flex flex-wrap gap-2">
                                    {babies.map(baby => (
                                        <button
                                            key={baby.id}
                                            onClick={() => setCurrentBaby(baby)}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold transition-colors ${currentBaby?.id === baby.id
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-sm">face</span>
                                            {baby.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
                            <div className="px-3 py-2 mb-2">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">메뉴</p>
                            </div>

                            {navigationLinks.map(link => {
                                const isActive = pathname === link.href
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${isActive
                                            ? 'bg-primary/10 text-primary font-bold'
                                            : 'text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                                            }`}
                                    >
                                        <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-primary' : 'text-slate-400'}`}>
                                            {link.icon}
                                        </span>
                                        {link.label}
                                    </Link>
                                )
                            })}
                        </div>

                        {user && (
                            <div className="p-5 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                                        {user.user_metadata?.avatar_url ? (
                                            <img src={ensureHttps(user.user_metadata.avatar_url)!} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="material-symbols-outlined text-slate-400">person</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col truncate">
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span>
                                        <span className="text-xs text-slate-400 truncate">{user.email}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">logout</span>
                                    로그아웃
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </header>
    )
}
