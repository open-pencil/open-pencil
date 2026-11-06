import { localeFrom } from '@nanostores/i18n'
import { atom, onStart } from 'nanostores'

export const AVAILABLE_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'ja', 'pl', 'ru', 'zh-CN'] as const
export type Locale = (typeof AVAILABLE_LOCALES)[number]
export type TranslatedLocale = Exclude<Locale, 'en'>

export const TRANSLATED_LOCALES = [
  'de',
  'es',
  'fr',
  'it',
  'ja',
  'pl',
  'ru',
  'zh-CN'
] as const satisfies ReadonlyArray<TranslatedLocale>

export const LOCALE_DIR_NAMES = {
  de: 'de',
  es: 'es',
  fr: 'fr',
  it: 'it',
  ja: 'ja',
  pl: 'pl',
  ru: 'ru',
  'zh-CN': 'zh-cn'
} as const satisfies Record<TranslatedLocale, string>

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  pl: 'Polski',
  ru: 'Русский',
  'zh-CN': '中文（简体）'
}

const LOCALE_STORAGE_KEY = 'open-pencil-locale'

export const localeSetting = atom<Locale | undefined>(undefined)

/** A tag's language and script, as Unicode's likely subtags fill them in: `zh-TW` is `zh-Hant`. */
function languageScript(tag: string): string | null {
  try {
    const { language, script } = new Intl.Locale(tag).maximize()
    return `${language}-${script ?? ''}`
  } catch {
    return null
  }
}

/**
 * The first browser language with a locale: the same tag, or the same language in the same
 * script, so `zh` and `zh-SG` read Simplified Chinese and `zh-TW`, written in Traditional, does not.
 */
export function resolveBrowserLocale(languages: readonly string[]): Locale {
  const localesByCode = new Map(AVAILABLE_LOCALES.map((code) => [code.toLowerCase(), code]))
  const localesByScript = new Map(AVAILABLE_LOCALES.map((code) => [languageScript(code), code]))
  for (const language of languages) {
    const match =
      localesByCode.get(language.toLowerCase()) ?? localesByScript.get(languageScript(language))
    if (match) return match
  }
  return 'en'
}

const browserLocale = atom<Locale>('en')
onStart(browserLocale, () => {
  if (typeof navigator === 'undefined') return
  const browserLanguages = Array.isArray(navigator.languages) ? navigator.languages : []
  const languages = browserLanguages.length > 0 ? browserLanguages : [navigator.language || 'en']
  browserLocale.set(resolveBrowserLocale(languages))
})

export const locale = localeFrom(localeSetting, browserLocale)

function getLocalStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  if (typeof localStorage.getItem !== 'function') return null
  if (typeof localStorage.setItem !== 'function') return null
  return localStorage
}

export function setLocale(code: Locale) {
  localeSetting.set(code)
  getLocalStorage()?.setItem(LOCALE_STORAGE_KEY, code)
}

const saved = getLocalStorage()?.getItem(LOCALE_STORAGE_KEY) as Locale | null | undefined
if (saved && AVAILABLE_LOCALES.includes(saved)) {
  localeSetting.set(saved)
}
