"use client"

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'

export function AuthModal() {
    const { isAuthModalOpen, setAuthModalOpen } = useAppStore()
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [sent, setSent] = useState(false)

    if (!isAuthModalOpen) return null

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: `${location.origin}/auth/callback` },
            })
            if (error) throw error
            setSent(true)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleKakaoLogin = async () => {
        setIsLoading(true)
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'kakao',
                options: { redirectTo: `${location.origin}/auth/callback` }
            })
            if (error) throw error
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '카카오 로그인 오류가 발생했습니다.')
            setIsLoading(false)
        }
    }

    const handleClose = () => {
        setAuthModalOpen(false)
        setSent(false)
        setEmail('')
        setError('')
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 relative animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                {sent ? (
                    /* Success State */
                    <div className="text-center py-4">
                        <div className="size-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <span className="material-symbols-outlined text-primary text-4xl">mark_email_read</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">이메일을 확인하세요!</h2>
                        <p className="text-sm text-slate-500 mb-1"><strong className="text-slate-700 dark:text-slate-300">{email}</strong>으로</p>
                        <p className="text-sm text-slate-500 mb-6">로그인 링크를 보냈어요. 클릭하면 바로 시작됩니다!</p>
                        <button
                            onClick={handleClose}
                            className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            닫기
                        </button>
                    </div>
                ) : (
                    /* Login Form */
                    <>
                        <div className="text-center mb-7">
                            <div className="size-12 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-primary text-3xl">child_care</span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">맘마로그 시작하기</h2>
                            <p className="text-sm text-slate-500">우리아이 식단 관리를 시작해보세요</p>
                        </div>

                        <div className="flex flex-col gap-4">
                            {/* Kakao */}
                            <button
                                onClick={handleKakaoLogin}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-[#FEE500] text-[#191919] rounded-xl font-bold shadow-sm hover:brightness-95 active:scale-95 transition-all disabled:opacity-50"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                    <path d="M12 3c-5.523 0-10 3.518-10 7.857 0 2.768 1.83 5.2 4.606 6.516-.245.89-.884 3.235-.917 3.42-.1.542.176.53.336.425.13-.085 2.112-1.42 2.96-1.996C10.02 19.64 10.988 19.714 12 19.714c5.523 0 10-3.518 10-7.857S17.523 3 12 3z" />
                                </svg>
                                카카오로 3초만에 시작하기
                            </button>

                            <div className="relative flex items-center">
                                <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
                                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-medium uppercase">또는 이메일로</span>
                                <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
                            </div>

                            {/* Email Magic Link */}
                            <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
                                <input
                                    type="email"
                                    placeholder="이메일 주소 입력"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-sm disabled:opacity-50"
                                >
                                    {isLoading ? '처리 중...' : '✉️ 매직 링크 받기'}
                                </button>
                            </form>

                            {error && (
                                <div className="p-3 rounded-xl text-xs text-center font-medium bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                    {error}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
