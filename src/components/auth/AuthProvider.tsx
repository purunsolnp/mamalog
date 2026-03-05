"use client"

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { getBabies, getProfile } from '@/lib/api'

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setUser, setProfile, setBabies, setCurrentBaby } = useAppStore()

    useEffect(() => {
        const handleUserUpdate = async (user: any) => {
            setUser(user)
            if (user) {
                try {
                    const [prof, babyList] = await Promise.all([
                        getProfile(user.id),
                        getBabies(user.id)
                    ])
                    if (prof) setProfile(prof)
                    if (babyList) {
                        setBabies(babyList)
                        // Preserve selected baby if it still exists in the fetched list
                        const currentId = useAppStore.getState().currentBaby?.id
                        if (currentId && babyList.some(b => b.id === currentId)) {
                            setCurrentBaby(babyList.find(b => b.id === currentId)!)
                        } else if (babyList.length > 0) {
                            setCurrentBaby(babyList[0])
                        } else {
                            setCurrentBaby(null)
                        }
                    }
                } catch (e) {
                    console.error('Error fetching baseline user data', e)
                }
            } else {
                setProfile(null)
                setBabies([])
                setCurrentBaby(null)
            }
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleUserUpdate(session?.user ?? null)
        })

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            handleUserUpdate(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [setUser, setProfile, setBabies, setCurrentBaby])

    return <>{children}</>
}
