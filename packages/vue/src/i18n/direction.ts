import { eachMessage } from '@nanostores/i18n'
import type { ComponentsJSON } from '@nanostores/i18n'

import type { TranslatedLocale } from '#vue/i18n/locale'

/** Locales written right to left. */
export const RIGHT_TO_LEFT_LOCALES: ReadonlySet<TranslatedLocale> = new Set<TranslatedLocale>([
  'ar'
])

const RIGHT_TO_LEFT_MARK = String.fromCodePoint(0x200f)
const FIRST_STRONG_ISOLATE = String.fromCodePoint(0x2068)
const POP_DIRECTIONAL_ISOLATE = String.fromCodePoint(0x2069)

const PLACEHOLDER = /\{\w+\}/g

function isolate(placeholder: string): string {
  return `${FIRST_STRONG_ISOLATE}${placeholder}${POP_DIRECTIONAL_ISOLATE}`
}

const markMessages = eachMessage((message) =>
  message
    ? `${RIGHT_TO_LEFT_MARK}${message.replaceAll(PLACEHOLDER, isolate)}${RIGHT_TO_LEFT_MARK}`
    : message
)

/**
 * A locale's translations as the interface shows them. A right-to-left message sits between
 * right-to-left marks, so its leading and closing punctuation stay with it when someone keeps the
 * interface left to right; each placeholder is isolated, so a value put into it (a version, a
 * path, a name) keeps its own order: `0.17.0-beta.2`, not `beta.2-0.17.0`.
 */
export function directedTranslations(code: TranslatedLocale, translations: ComponentsJSON) {
  if (!RIGHT_TO_LEFT_LOCALES.has(code)) return translations
  return markMessages(translations) as ComponentsJSON
}
