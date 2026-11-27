import { parseDate } from '@internationalized/date'

import { METRICS_TIME_ZONE } from './days'

/** Metrics are counted in UTC days, so every label is formatted in UTC too. */
const DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
})
const TIME = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC'
})
const COUNT = new Intl.NumberFormat('en-US')
const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const PERCENT = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 0
})
const CHANGE = new Intl.NumberFormat('en-US', { signDisplay: 'exceptZero' })

export const formatDay = (day: string) => DAY.format(parseDate(day).toDate(METRICS_TIME_ZONE))
export const formatTime = (iso: string) => `${TIME.format(new Date(iso))} UTC`
export const formatCount = (value: number) => COUNT.format(value)
/** A count short enough for a chart axis: `950`, `1.5K`, `10K`. */
export const formatCompact = (value: number) => COMPACT.format(value)
export const formatPercent = (value: number) => PERCENT.format(value)
export const formatChange = (value: number) => CHANGE.format(value)

const REGION = new Intl.DisplayNames('en-US', { type: 'region' })

// Cloudflare's codes for traffic it cannot place in a country; neither is a region subtag, and
// `Intl.DisplayNames` throws on `T1` rather than returning nothing.
const CLOUDFLARE_PSEUDO_COUNTRIES: Record<string, string> = { T1: 'Tor', XX: 'Unknown' }

/** A country's name from Cloudflare's two-letter code, or the code when it has none. */
export function formatCountry(code: string): string {
  const pseudo = CLOUDFLARE_PSEUDO_COUNTRIES[code]
  if (pseudo) return pseudo
  try {
    return REGION.of(code) ?? code
  } catch {
    return code
  }
}

const SHARE = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
  roundingMode: 'trunc'
})

/** A share that must never round up to 100% while anything is left: 697 of 699 is 99.7%. */
export const formatShare = (value: number) => SHARE.format(value)

const OS_NAMES: Record<string, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  android: 'Android',
  ios: 'iOS'
}

/** The OS as people write it, from the lowercase name pings carry. */
export const formatOS = (os: string) => OS_NAMES[os] ?? os.charAt(0).toUpperCase() + os.slice(1)

const BYTE_UNITS = ['kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const

/** A storage size in decimal units, as Cloud's plans state them: "1.2 GB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${formatCount(bytes)} B`
  const exponent = Math.min(BYTE_UNITS.length, Math.floor(Math.log10(bytes) / 3))
  return new Intl.NumberFormat('en-US', {
    style: 'unit',
    unit: BYTE_UNITS[exponent - 1],
    unitDisplay: 'short',
    maximumFractionDigits: 1
  }).format(bytes / 1000 ** exponent)
}
