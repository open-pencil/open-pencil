import { parseDate } from '@internationalized/date'

import { MAX_METRICS_RANGE_DAYS } from '@open-pencil/feedback/contract'

import { formatDay } from './format'

export type MetricsRangePreset = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom'

/** A span of whole UTC days, both ends included, as ISO dates. */
export interface MetricsRange {
  preset: MetricsRangePreset
  start: string
  end: string
}

export const METRICS_RANGE_PRESETS: {
  value: Exclude<MetricsRangePreset, 'custom'>
  label: string
}[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' }
]

// "All time" is as long as the API answers; the history is far shorter for now.
const PRESET_DAYS = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: MAX_METRICS_RANGE_DAYS
} as const

/**
 * The days a preset covers, ending today. Ranges never start before `earliest`, the first day
 * anything was recorded, so "Last 90 days" in the first week shows the same days as "All time";
 * before the first answer that day is not known yet and the preset's full length is asked for.
 */
export function presetRange(
  preset: Exclude<MetricsRangePreset, 'custom'>,
  today: string,
  earliest?: string | null
): MetricsRange {
  const start = parseDate(today)
    .subtract({ days: PRESET_DAYS[preset] - 1 })
    .toString()
  return { preset, start: earliest && start < earliest ? earliest : start, end: today }
}

export function rangeLabel(range: MetricsRange): string {
  const preset = METRICS_RANGE_PRESETS.find((option) => option.value === range.preset)
  if (preset) return preset.label
  if (range.start === range.end) return formatDay(range.start)
  return `${formatDay(range.start)} – ${formatDay(range.end)}`
}

const RANGE_PHRASES: Record<Exclude<MetricsRangePreset, 'custom'>, string> = {
  today: 'today',
  '7d': 'in the last 7 days',
  '30d': 'in the last 30 days',
  '90d': 'in the last 90 days',
  all: 'in total'
}

/** The range as the end of a sentence: "+374 in the last 7 days". */
export function rangePhrase(range: MetricsRange): string {
  if (range.preset !== 'custom') return RANGE_PHRASES[range.preset]
  return range.start === range.end
    ? `on ${formatDay(range.start)}`
    : `${formatDay(range.start)} – ${formatDay(range.end)}`
}
