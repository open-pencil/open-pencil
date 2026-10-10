import { useData, withBase } from 'vitepress'
import { computed, inject, provide, type InjectionKey } from 'vue'

import type { LandingMessages } from './types'

export type { LandingMessages } from './types'

const LANDING_MESSAGES: InjectionKey<LandingMessages> = Symbol('landing-messages')

/**
 * Gives the landing its copy. Each locale's `index.md` imports only its own catalog and passes
 * it to `LandingPage`, so a page downloads one locale and other docs pages download none.
 */
export function provideLandingMessages(messages: LandingMessages): void {
  provide(LANDING_MESSAGES, messages)
}

/** The landing copy of the page being viewed. */
export function useLandingMessages() {
  const messages = inject(LANDING_MESSAGES)
  if (!messages) throw new Error('useLandingMessages() needs a LandingPage with its messages')
  return computed(() => messages)
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
