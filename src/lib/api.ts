import { supabase } from './supabase'
import { MealLog, DailySummary, Profile, GrowthChart, Baby } from '@/types/database.types'

// Storage Helper: Upload Canvas Image
export const uploadCanvasImage = async (userId: string, dateStr: string, mealType: string, dataUrl: string): Promise<string | null> => {
    try {
        // Convert base64 Data URL to Blob
        const base64Data = dataUrl.split(',')[1]
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'image/png' })

        // Generate unique filename based on date and meal type
        const fileName = `${userId}/${dateStr}_${mealType}_${Date.now()}.png`

        // Upload to Supabase Storage Bucket ('meal_images')
        const { data, error } = await supabase.storage
            .from('meal_images')
            .upload(fileName, blob, {
                contentType: 'image/png',
                upsert: true
            })

        if (error) {
            console.error("Storage upload error:", error)
            return null
        }

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('meal_images')
            .getPublicUrl(fileName)

        return publicUrl
    } catch (e) {
        console.error("Image processing error:", e)
        return null
    }
}

// Database Helper: Save Meal Log
export const saveMealLog = async (logData: Omit<MealLog, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
        .from('meal_logs')
        .insert([logData])
        .select()
        .single()

    if (error) {
        console.error("Error saving meal log:", error)
        throw error
    }

    return data
}

// Database Helper: Get Meal Logs for a month
export const getMealLogs = async (userId: string, startDate: string, endDate: string, babyId?: string) => {
    let query = supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)

    if (babyId) {
        query = query.eq('baby_id', babyId)
    }

    const { data, error } = await query.order('date', { ascending: false })

    if (error) {
        console.error("Error fetching meal logs:", error)
        throw error
    }

    return data as MealLog[]
}

// Database Helper: Delete Meal Log
export const deleteMealLog = async (id: string) => {
    const { error } = await supabase
        .from('meal_logs')
        .delete()
        .eq('id', id)

    if (error) {
        console.error("Error deleting meal log:", error)
        throw error
    }
}

// Database Helper: Update Meal Log
export const updateMealLog = async (
    id: string,
    fields: Partial<Pick<MealLog, 'meal_name' | 'meal_items' | 'note_text' | 'satisfaction' | 'nutrition' | 'meal_type'>>
) => {
    const { data, error } = await supabase
        .from('meal_logs')
        .update(fields)
        .eq('id', id)
        .select()

    if (error) {
        const msg = error.message || error.details || JSON.stringify(error) || '알 수 없는 오류'
        console.error("Error updating meal log:", msg, error)
        throw new Error(msg)
    }

    if (!data || data.length === 0) {
        throw new Error('수정할 기록을 찾을 수 없습니다. 삭제됐거나 권한이 없을 수 있어요.')
    }

    return data[0] as MealLog
}

// Database Helper: Get Profile
export const getProfile = async (userId: string) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

    if (error) {
        console.error("Error fetching profile:", error)
        throw error
    }
    return data as Profile | null
}

// Database Helper: Update Profile (User Info)
export const updateProfile = async (userId: string, profileData: Partial<Profile>) => {
    const { data, error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', userId)
        .select()
        .single()

    if (error) {
        console.error("Error updating profile:", error)
        throw error
    }
    return data as Profile
}

// Database Helper: Get Babies
export const getBabies = async (userId: string) => {
    const { data, error } = await supabase
        .from('babies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error("Error fetching babies:", error)
        throw error
    }
    return data as Baby[]
}

// Database Helper: Save/Update Baby
export const saveBaby = async (babyData: Omit<Baby, 'id' | 'created_at'> & { id?: string }) => {
    const { id, ...rest } = babyData
    const payload = id ? { id, ...rest } : rest

    const { data, error } = await supabase
        .from('babies')
        .upsert(payload)
        .select()
        .single()

    if (error) {
        console.error("Error saving baby:", error)
        throw error
    }
    return data as Baby
}

// Database Helper: Delete Baby
export const deleteBaby = async (id: string) => {
    const { error } = await supabase
        .from('babies')
        .delete()
        .eq('id', id)

    if (error) {
        console.error("Error deleting baby:", error)
        throw error
    }
}

// Database Helper: Get Daily Summaries for a month
export const getDailySummaries = async (userId: string, startDate: string, endDate: string, babyId?: string) => {
    let query = supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)

    if (babyId) {
        query = query.eq('baby_id', babyId)
    }

    const { data, error } = await query

    if (error) {
        console.error("Error fetching daily summaries:", error)
        throw error
    }

    return data as DailySummary[]
}

// Database Helper: Save Daily Summary (Upsert)
export const saveDailySummary = async (summaryData: Omit<DailySummary, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
        .from('daily_summaries')
        .upsert([summaryData], {
            onConflict: 'baby_id,date'
        })
        .select()
        .single()

    if (error) {
        console.error("Error saving daily summary:", error)
        throw error
    }

    return data as DailySummary
}

// Database Helper: Get Growth Charts
export const getGrowthCharts = async (type: 'height_age' | 'weight_age' | 'weight_height', gender: '남자' | '여자') => {
    const { data, error } = await supabase
        .from('growth_charts')
        .select('*')
        .eq('type', type)
        .eq('gender', gender)
        .order('x_value', { ascending: true })

    if (error) {
        console.error("Error fetching growth charts:", error)
        throw error
    }

    return data as GrowthChart[]
}
