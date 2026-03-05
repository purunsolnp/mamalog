/**
 * 식재료 명칭을 정규화합니다.
 * '죽', '국', '밥' 등의 접미사가 붙어 있는 경우 이를 제거합니다.
 * (단, 명칭이 2글자 이상인 경우에만 접미사를 제거하여 '죽', '국' 자체가 재료인 경우를 보호합니다.)
 */
export function normalizeIngredient(name: string): string {
    if (!name) return ''
    const trimmed = name.trim()
    if (trimmed.length < 2) return trimmed

    // '죽', '국', '밥', '찌개'로 끝나는지 확인
    if (trimmed.endsWith('죽') || trimmed.endsWith('국') || trimmed.endsWith('밥')) {
        return trimmed.slice(0, -1)
    }
    if (trimmed.endsWith('찌개')) {
        return trimmed.slice(0, -2)
    }

    return trimmed
}

/**
 * 텍스트에서 식재료 목록을 추출하고 정규화합니다.
 * 공백이나 쉼표를 기준으로 분리합니다.
 */
export function extractIngredients(text: string): string[] {
    if (!text) return []
    return text
        .split(/[,\s]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(normalizeIngredient)
        .filter(Boolean)
}

/**
 * 인벤토리(냉장고) 정보를 활용하여 더욱 똑똑하게 식재료를 추출합니다.
 * "소고기무국" 처럼 붙어있는 단어에서도 냉장고에 있는 "소고기", "무"를 찾아냅니다.
 */
export function smartExtractIngredients(text: string, knownIngredients: string[]): string[] {
    const basicIngs = extractIngredients(text)
    const result = new Set(basicIngs)

    if (!text || !knownIngredients.length) return Array.from(result)

    // 접미사를 뗀 전체 텍스트 (예: "소고기무국" -> "소고기무")
    const normalizedText = normalizeIngredient(text)

    // 알려진 재료들이 정규화된 텍스트 안에 포함되어 있는지 전수 조사
    knownIngredients.forEach(known => {
        const trimmedKnown = known.split(' (')[0].trim() // "소고기 (안심)" -> "소고기"
        const normalizedKnown = normalizeIngredient(trimmedKnown)

        if (normalizedKnown.length >= 2 && normalizedText.includes(normalizedKnown)) {
            result.add(normalizedKnown)
        }
    })

    return Array.from(result)
}
