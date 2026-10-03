import { useData, withBase } from 'vitepress'
import { computed } from 'vue'

import { de } from './de'
import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import { it } from './it'
import { pl } from './pl'
import { ru } from './ru'
import type { LandingMessages } from './types'

export type { LandingMessages } from './types'

/** Keyed by the `lang` of each docs locale in `.vitepress/locales.ts`. */
const CATALOGS: Record<string, LandingMessages> = { en, de, es, fr, it, pl, ru }

/** The landing copy for the docs locale being viewed, falling back to English. */
export function useLandingMessages() {
  const { lang } = useData()
  return computed(() => CATALOGS[lang.value] ?? en)
}

/**
 * Resolves a site path inside the current locale. Pass `translated: false` for pages that
 * exist only in English, which link to the canonical page instead of a missing one.
 */
export function useLocalePath() {
  const { localeIndex } = useData()
  return (path: string, { translated = true } = {}) => {
    const prefix = translated && localeIndex.value !== 'root' ? `/${localeIndex.value}` : ''
    return withBase(`${prefix}${path}`)
  }
}

export function withCount(template: string, count: number): string {
  return template.replace('{count}', String(count))
}
