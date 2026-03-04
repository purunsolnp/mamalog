"use client"

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setUser } = useAppStore()

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
        })

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [setUser])

    return <>{children}</>
}
