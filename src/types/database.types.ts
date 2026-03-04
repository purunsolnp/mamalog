export type Profile = {
    id: string
    email: string
    provider: string
    // Legacy baby info (moved to babies table)
    baby_name: string | null
    baby_birthday: string | null
    baby_gender: '남자' | '여자' | null
    created_at: string
}

export type Baby = {
    id: string
    user_id: string
    name: string
    birthday: string // YYYY-MM-DD
    gender: '남자' | '여자'
    created_at: string
}

export type MealItem = {
    name: string
    ingredients: string[]
    satisfaction: number // 1=거의안먹음, 2=조금, 4=반쯤, 5=다먹음
}

export type MealLog = {
    id: string
    user_id: string
    baby_id: string | null
    date: string // YYYY-MM-DD
    meal_type: string // '아침', '간식1', '점심', '간식2', '저녁'
    meal_name: string | null // Legacy field
    meal_items: MealItem[] // New: per-dish items
    nutrition: {
        carbs: number
        protein: number
        fat: number
        vitamins: number
    }
    satisfaction: number | null // Legacy field (kept for old records)
    note_text: string | null
    handwritten_image_url: string | null // Legacy field
    created_at: string
}

export type Inventory = {
    id: string
    user_id: string
    ingredient_name: string
    expiry_date: string | null
    created_at: string
}

export type PhotoLog = {
    id: string
    meal_log_id: string
    image_url: string
    created_at: string
}

export type DailySummary = {
    id: string
    user_id: string
    baby_id: string | null // Linked baby
    date: string // YYYY-MM-DD
    water_ml: number
    sleep_hours: number
    growth_status: string // '양호함', '주의', '정체' 등 ( legacy )
    weight_kg: number | null
    height_cm: number | null
    note_text: string | null
    created_at: string
}

export type GrowthChart = {
    type: 'height_age' | 'weight_age' | 'weight_height'
    gender: '남자' | '여자'
    x_value: number
    p3: number | null
    p5: number | null
    p10: number | null
    p25: number | null
    p50: number | null
    p75: number | null
    p90: number | null
    p95: number | null
    p97: number | null
}
