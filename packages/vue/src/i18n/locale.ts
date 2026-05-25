import { browser, localeFrom } from '@nanostores/i18n'
import { atom } from 'nanostores'

export const AVAILABLE_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'ja', 'pl', 'ru', 'zh-CN'] as const
export type Locale = (typeof AVAILABLE_LOCALES)[number]

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

export const locale = localeFrom(localeSetting, browser({ available: AVAILABLE_LOCALES }))

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
