import { locale } from '@open-pencil/vue'

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
