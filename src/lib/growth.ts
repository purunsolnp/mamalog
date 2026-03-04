import { GrowthChart } from '@/types/database.types'

const PERCENTILE_KEYS = ['p3', 'p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95', 'p97'] as const
const PERCENTILE_VALUES = [3, 5, 10, 25, 50, 75, 90, 95, 97]

type PercentileKey = typeof PERCENTILE_KEYS[number]

/**
 * Linearly interpolate percentile boundary values for a given x.
 */
function interpolateRow(chart: GrowthChart[], x: number): Record<PercentileKey, number> {
    const sorted = [...chart].sort((a, b) => a.x_value - b.x_value)
    const minX = sorted[0].x_value
    const maxX = sorted[sorted.length - 1].x_value
    const clampedX = Math.max(minX, Math.min(maxX, x))

    let lower = sorted[0]
    let upper = sorted[sorted.length - 1]

    for (let i = 0; i < sorted.length - 1; i++) {
        if (clampedX >= sorted[i].x_value && clampedX <= sorted[i + 1].x_value) {
            lower = sorted[i]
            upper = sorted[i + 1]
            break
        }
    }

    const ratio = lower.x_value === upper.x_value
        ? 0
        : (clampedX - lower.x_value) / (upper.x_value - lower.x_value)

    const result = {} as Record<PercentileKey, number>
    for (const key of PERCENTILE_KEYS) {
        const vL = (lower[key] as number) ?? 0
        const vU = (upper[key] as number) ?? 0
        result[key] = vL + (vU - vL) * ratio
    }
    return result
}

/**
 * Calculate the exact estimated percentile using linear interpolation between
 * the two nearest percentile boundary values.
 * Returns a number 0-100.
 */
export function calculateExactPercentile(chart: GrowthChart[], x: number, y: number): number {
    if (chart.length === 0) return -1

    const row = interpolateRow(chart, x)
    const boundaries = PERCENTILE_KEYS.map((k, i) => ({ pct: PERCENTILE_VALUES[i], val: row[k] }))

    // Below p3
    if (y <= boundaries[0].val) {
        // Extrapolate below p3: treat 0 as 0th percentile (rough)
        const frac = y / (boundaries[0].val || 1)
        return Math.max(0, frac * 3)
    }

    // Above p97
    if (y >= boundaries[boundaries.length - 1].val) {
        const last = boundaries[boundaries.length - 1]
        const secondLast = boundaries[boundaries.length - 2]
        const ratio = (y - last.val) / (last.val - secondLast.val || 1)
        return Math.min(100, 97 + ratio * 3)
    }

    // Between two boundaries: linear interpolation
    for (let i = 0; i < boundaries.length - 1; i++) {
        const lo = boundaries[i]
        const hi = boundaries[i + 1]
        if (y >= lo.val && y <= hi.val) {
            const ratio = (y - lo.val) / (hi.val - lo.val || 1)
            return lo.pct + (hi.pct - lo.pct) * ratio
        }
    }

    return -1
}

/**
 * Returns a human-readable description of the percentile.
 */
export function describePercentile(pct: number): { label: string; color: string; emoji: string } {
    if (pct < 3) return { label: '3백분위 미만 (저체중/저신장 주의)', color: 'text-red-500', emoji: '⚠️' }
    if (pct < 10) return { label: '10백분위 미만 (평균 이하)', color: 'text-orange-400', emoji: '📉' }
    if (pct < 25) return { label: '25백분위 미만 (다소 작음)', color: 'text-yellow-500', emoji: '🔽' }
    if (pct < 75) return { label: '정상 범위 (25~75백분위)', color: 'text-primary', emoji: '✅' }
    if (pct < 90) return { label: '75백분위 이상 (평균보다 큼)', color: 'text-blue-500', emoji: '🔼' }
    if (pct < 97) return { label: '90백분위 이상 (상위권)', color: 'text-purple-500', emoji: '🏆' }
    return { label: '97백분위 초과 (매우 큼, 과체중 확인)', color: 'text-red-400', emoji: '⚠️' }
}

/**
 * Legacy string helper — kept for backward compatibility with existing callers.
 * Now returns the exact interpolated percentile as a formatted string.
 */
export function calculatePercentileFromChart(chart: GrowthChart[], x: number, y: number): string {
    const pct = calculateExactPercentile(chart, x, y)
    if (pct < 0) return '데이터 없음'
    return `${pct.toFixed(1)}백분위`
}

// Deprecated stub
export function calculateWeightPercentile(gender: '남자' | '여자', ageInMonths: number, weightKg: number): string {
    return '데이터를 불러오는 중...'
}
