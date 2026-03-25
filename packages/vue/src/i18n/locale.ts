import { browser, localeFrom } from '@nanostores/i18n'
import { atom } from 'nanostores'

export const AVAILABLE_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pl', 'ru'] as const
export type Locale = (typeof AVAILABLE_LOCALES)[number]

export const localeSetting = atom<Locale | undefined>(undefined)

export const locale = localeFrom(localeSetting, browser({ available: AVAILABLE_LOCALES }))

export function setLocale(code: Locale) {
  localeSetting.set(code)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('open-pencil-locale', code)
  }
}

if (typeof localStorage !== 'undefined') {
  const saved = localStorage.getItem('open-pencil-locale') as Locale | null
  if (saved && AVAILABLE_LOCALES.includes(saved)) {
    localeSetting.set(saved)
  }
}
