"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'

export default function AuthCallback() {
    const router = useRouter()
    const { setAuthModalOpen } = useAppStore()

    useEffect(() => {
        // 현재 URL의 세션 정보를 Supabase가 자동으로 파싱합니다.
        // 파싱이 완료되거나 이미 로그인된 상태라면 홈으로 보냅니다.
        const checkSession = async () => {
            const { data } = await supabase.auth.getSession()
            if (data.session) {
                setAuthModalOpen(false)
                router.push('/')
            }
        }

        checkSession()

        // AuthState 변경 이벤트로 더욱 확실하게 캐치합니다.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                setAuthModalOpen(false)
                router.push('/')
            }
        })

        // 만약 네트워크 지연 등으로 파싱이 오래걸릴 경우를 대비한 타임아웃
        const timer = setTimeout(() => {
            router.push('/')
        }, 3000)

        return () => {
            subscription.unsubscribe()
            clearTimeout(timer)
        }
    }, [router, setAuthModalOpen])

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background-light dark:bg-background-dark">
            <div className="flex flex-col items-center gap-4">
                <span className="material-symbols-outlined text-primary text-5xl animate-spin">refresh</span>
                <p className="text-slate-600 dark:text-slate-400 font-bold">안전하게 로그인 처리 중입니다...</p>
                <p className="text-sm text-slate-400">잠시만 기다려주세요.</p>
            </div>
        </div>
    )
}
