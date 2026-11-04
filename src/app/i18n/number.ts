import { locale } from '@open-pencil/vue/i18n'

const numberFormats = new Map<string, Intl.NumberFormat>()

/** Numbers follow the app's language, not the browser's, like the rest of the interface. */
export function formatNumber(value: number): string {
  const language = locale.get()
  let format = numberFormats.get(language)
  if (!format) {
    format = new Intl.NumberFormat(language, { maximumFractionDigits: 2 })
    numberFormats.set(language, format)
  }
  return format.format(value)
}

const compactFormats = new Map<string, Intl.NumberFormat>()

/** A large count in the app's language, shortened as people say it: 84K, 1.2M. */
export function formatCompactNumber(value: number): string {
  const language = locale.get()
  let format = compactFormats.get(language)
  if (!format) {
    format = new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 })
    compactFormats.set(language, format)
  }
  return format.format(value)
}
