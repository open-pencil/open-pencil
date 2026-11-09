import { eachMessage } from '@nanostores/i18n'
import type { ComponentsJSON } from '@nanostores/i18n'

import type { TranslatedLocale } from '#vue/i18n/locale'

/** Locales written right to left. */
export const RIGHT_TO_LEFT_LOCALES: ReadonlySet<TranslatedLocale> = new Set<TranslatedLocale>([
  'ar'
])

const RIGHT_TO_LEFT_MARK = String.fromCodePoint(0x200f)

const markMessages = eachMessage((message) =>
  message ? `${RIGHT_TO_LEFT_MARK}${message}${RIGHT_TO_LEFT_MARK}` : message
)

/**
 * A locale's translations as the interface shows them. The interface stays left to right in
 * every locale, so a right-to-left message's leading and closing punctuation would take that
 * direction and show at the wrong end; right-to-left marks around each message keep it with the
 * text.
 */
export function directedTranslations(code: TranslatedLocale, translations: ComponentsJSON) {
  if (!RIGHT_TO_LEFT_LOCALES.has(code)) return translations
  return markMessages(translations) as ComponentsJSON
}
