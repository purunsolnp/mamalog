import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { MealLog, Inventory, DailySummary, Profile, GrowthChart, Baby } from '@/types/database.types'

type AppState = {
    selectedDate: Date
    selectedMealType: string
    setDate: (date: Date) => void
    setMealType: (type: string) => void

    // Shared Nutrition State (used across session)
    currentNutrition: { carbs: number; protein: number; fat: number; vitamins: number }
    setCurrentNutrition: (nutrition: { carbs: number; protein: number; fat: number; vitamins: number }) => void

    // Auth State
    user: User | null
    profile: Profile | null
    babies: Baby[]
    currentBaby: Baby | null
    setUser: (user: User | null) => void
    setProfile: (profile: Profile | null) => void
    setBabies: (babies: Baby[]) => void
    setCurrentBaby: (baby: Baby | null) => void

    growthCharts: GrowthChart[]
    setGrowthCharts: (charts: GrowthChart[]) => void

    isAuthModalOpen: boolean
    setAuthModalOpen: (isOpen: boolean) => void
    isEditorOpen: boolean
    setEditorOpen: (isOpen: boolean) => void
    isProfileModalOpen: boolean
    setProfileModalOpen: (isOpen: boolean) => void

    // Data State
    logs: MealLog[]
    editingLog: MealLog | null
    setLogs: (logs: MealLog[]) => void
    setEditingLog: (log: MealLog | null) => void
    inventories: Inventory[]
    setInventories: (inventories: Inventory[]) => void
    dailySummaries: DailySummary[]
    setDailySummaries: (summaries: DailySummary[]) => void
    latestGrowthSummary: DailySummary | null
    setLatestGrowthSummary: (summary: DailySummary | null) => void
}

export const useAppStore = create<AppState>((set) => ({
    selectedDate: new Date(),
    selectedMealType: '아침', // '아침', '간식1', '점심', '간식2', '저녁'

    setDate: (date) => set({ selectedDate: date }),
    setMealType: (type) => set({ selectedMealType: type }),

    currentNutrition: { carbs: 3, protein: 2, fat: 1, vitamins: 2 },
    setCurrentNutrition: (nutrition) => set({ currentNutrition: nutrition }),

    user: null,
    profile: null,
    babies: [],
    currentBaby: null,
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    setBabies: (babies) => set({ babies }),
    setCurrentBaby: (baby) => set({ currentBaby: baby }),

    growthCharts: [],
    setGrowthCharts: (growthCharts) => set({ growthCharts }),

    isAuthModalOpen: false,
    setAuthModalOpen: (isOpen) => set({ isAuthModalOpen: isOpen }),
    isEditorOpen: false,
    setEditorOpen: (isOpen) => set({ isEditorOpen: isOpen }),
    isProfileModalOpen: false,
    setProfileModalOpen: (isOpen) => set({ isProfileModalOpen: isOpen }),

    logs: [],
    editingLog: null,
    setLogs: (logs) => set({ logs }),
    setEditingLog: (editingLog) => set({ editingLog }),
    inventories: [],
    setInventories: (inventories) => set({ inventories }),
    dailySummaries: [],
    setDailySummaries: (summaries) => set({ dailySummaries: summaries }),
    latestGrowthSummary: null,
    setLatestGrowthSummary: (latestGrowthSummary) => set({ latestGrowthSummary }),
}))
