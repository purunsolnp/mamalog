import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const COMMON_UNITS = [
    'g', 'kg', 'ml', 'l', '큰술', '작은술', 'T', 't', '큰숟가락', '작은숟가락', '숟가락', '스푼',
    '개', '마리', '알', '모', '팩', '줌', '단', '덩이', '장', '컵', '조각', '포기', '쪽', '봉',
    '봉지', '스포이드', '병'
]

const AMOUNT_PATTERN = /[0-9./~]+(?:분[의]?[0-9])?/g

// 괄호, 특수기호 제거 정규표현식
const STRIP_PUNCTUATION = /[()[\]<>{}\-_+=\\'"]/g

export function extractCoreIngredient(text: string, knownIngNames: string[] = []): string {
    const raw = text.replace(STRIP_PUNCTUATION, ' ').trim()

    // 1. 이미 알고 있는 재고 목록과 일치하는 단어가 있으면 그것을 최우선으로 반환
    for (const known of knownIngNames) {
        // known이 '소고기 안심'일 때, raw가 '소고기 안심 30g'이면 일치
        if (raw.includes(known)) {
            return known
        }
        // known에 괄호 정보가 있는 경우 (예: '소고기 (안심)') 기본 이름만 비교
        const baseKnown = known.split('(')[0].trim()
        if (raw.includes(baseKnown)) {
            return known // 원래의 냉장고 재료 이름('소고기 (안심)')을 반환하여 매칭되도록 함
        }
    }

    // 2. 일치하는 게 없다면 기존 로직 (단위 및 수량 제거)
    let core = raw

    // Remove numbers and fraction-like strings
    core = core.replace(AMOUNT_PATTERN, ' ')

    // Remove units
    COMMON_UNITS.forEach(unit => {
        // Match unit at the end of string or followed by space
        const regex = new RegExp(`${unit}(?:\\s+|$)`, 'g')
        core = core.replace(regex, ' ')
    })

    // Remove other descriptors like '약간', '적당량', '조금', '반'
    const DESCRIPTORS = ['약간', '적당량', '조금', '반', '다진', '썬', '채썬', '간']
    DESCRIPTORS.forEach(desc => {
        const regex = new RegExp(`\\b${desc}\\b`, 'g')
        core = core.replace(regex, ' ')
    })

    // Clean up extra spaces
    core = core.replace(/\s+/g, ' ').trim()

    // If completely stripped down to nothing, fallback to original without numbers
    if (!core) {
        return raw.replace(AMOUNT_PATTERN, '').trim()
    }

    // 만약 core 내에 여러 단어가 띄어쓰기로 구분되어 있다면, 가장 앞의 단어(주재료명)만 사용
    // 예: "당근 소단" -> "당근", "소고기 다짐육" -> "소고기" (알고 있는 재고와 일치하지 않은 경우에만)
    const words = core.split(' ')
    if (words.length > 0) {
        return words[0]
    }

    return core
}

export function smartExtractIngredients(text: string, knownIngNames: string[] = []): string[] {
    if (!text) return []

    // Split by commas, slashes, logical separators, or spaces
    const parts = text.split(/[,/]|그리고|\b와\b|\b과\b|\b랑\b|\b이랑\b|\s+/g)

    const ingredients = parts
        .map(p => extractCoreIngredient(p, knownIngNames))
        .filter(p => p.length > 0)
        // Deduplicate
        .filter((item, index, self) => self.indexOf(item) === index)

    return ingredients
}
