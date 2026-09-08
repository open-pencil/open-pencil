import { localeFrom } from '@nanostores/i18n'
import { atom, onStart } from 'nanostores'

import { useStoredCloudLocale } from './storage'

export const CLOUD_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'ja', 'pl', 'ru', 'zh-CN'] as const
export type CloudLocale = (typeof CLOUD_LOCALES)[number]
export type TranslatedCloudLocale = Exclude<CloudLocale, 'en'>

const selectedLocale = atom<CloudLocale | undefined>(undefined)
const browserLocale = atom<CloudLocale>('en')

export function resolveCloudLocale(languages: readonly string[]): CloudLocale {
  const byCode = new Map(CLOUD_LOCALES.map((locale) => [locale.toLowerCase(), locale]))
  for (const language of languages) {
    const normalized = language.toLowerCase()
    const exact = byCode.get(normalized)
    if (exact) return exact
    const base = byCode.get(normalized.split('-')[0] ?? '')
    if (base) return base
  }
  return 'en'
}

onStart(browserLocale, () => {
  if (typeof navigator === 'undefined') return
  const languages = navigator.languages.length ? navigator.languages : [navigator.language]
  browserLocale.set(resolveCloudLocale(languages))
})

export const cloudLocale = localeFrom(selectedLocale, browserLocale)

export function setCloudLocale(locale: CloudLocale): void {
  selectedLocale.set(locale)
  useStoredCloudLocale().value = locale
}

const saved = useStoredCloudLocale().value
if (saved && CLOUD_LOCALES.includes(saved)) selectedLocale.set(saved)
