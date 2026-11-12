import { matchCloudLocale, type CloudLocale } from '#cloud/contract'
import { createI18n, type Components, type Messages } from '@nanostores/i18n'
import { mapValues } from 'es-toolkit'
import { parseAccept } from 'hono/utils/accept'
import { atom, type StoreValue } from 'nanostores'

import ar from './locales/ar.json'
import de from './locales/de.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import ja from './locales/ja.json'
import pl from './locales/pl.json'
import ptBR from './locales/pt-br.json'
import ru from './locales/ru.json'
import zhCN from './locales/zh-cn.json'
import { emailMessageDefaults } from './messages'

type TranslatedLocale = Exclude<CloudLocale, 'en'>

/** Each locale's translations of `emailMessageDefaults`, bundled so a Worker reads no files. */
const TRANSLATIONS: Record<TranslatedLocale, Record<string, string>> = {
  ar,
  de,
  es,
  fr,
  it,
  ja,
  pl,
  'pt-BR': ptBR,
  ru,
  'zh-CN': zhCN
}

/** Locales written right to left. */
const RIGHT_TO_LEFT: ReadonlySet<CloudLocale> = new Set<CloudLocale>(['ar'])

const RIGHT_TO_LEFT_MARK = String.fromCodePoint(0x200f)
const FIRST_STRONG_ISOLATE = String.fromCodePoint(0x2068)
const POP_DIRECTIONAL_ISOLATE = String.fromCodePoint(0x2069)

/**
 * Right-to-left messages as the app shows them: each between right-to-left marks, so punctuation
 * after a Latin name ends the sentence on its left, and each placeholder isolated, so a name or
 * address put into it keeps its own order: `report.pdf`, not `pdf.report`.
 */
function directed(messages: Record<string, string>): Record<string, string> {
  return mapValues(messages, (message) => {
    const isolated = message.replaceAll(
      /\{\w+\}/g,
      (placeholder) => `${FIRST_STRONG_ISOLATE}${placeholder}${POP_DIRECTIONAL_ISOLATE}`
    )
    return `${RIGHT_TO_LEFT_MARK}${isolated}${RIGHT_TO_LEFT_MARK}`
  })
}

export type EmailMessages = StoreValue<Messages<typeof emailMessageDefaults>>

/** The words, formats, and direction of email written in one locale. */
export type EmailLocalization = {
  locale: CloudLocale
  dir: 'ltr' | 'rtl'
  t: EmailMessages
  /** A moment in UTC, as Cloud doesn't know the reader's time zone: 13 November 2026, 10:00 UTC. */
  dateTime: (iso: string) => string
  /** Bytes in binary units, as the portal shows them: 300 MB, 10 GB. */
  storage: (bytes: number) => string
}

const STORAGE_UNITS = [
  { unit: 'gigabyte', bytes: 1024 ** 3 },
  { unit: 'megabyte', bytes: 1024 ** 2 },
  { unit: 'kilobyte', bytes: 1024 }
] as const

function messages(locale: CloudLocale): EmailMessages {
  const translations: Record<string, Components> =
    locale === 'en'
      ? {}
      : {
          [locale]: {
            email: RIGHT_TO_LEFT.has(locale) ? directed(TRANSLATIONS[locale]) : TRANSLATIONS[locale]
          }
        }
  // Every translation is in the cache, so nothing is ever fetched.
  const i18n = createI18n(atom(locale), {
    baseLocale: 'en',
    cache: translations,
    get: async () => ({})
  })
  return i18n('email', emailMessageDefaults).get()
}

const localizations = new Map<CloudLocale, EmailLocalization>()

export function emailLocalization(locale: CloudLocale): EmailLocalization {
  const cached = localizations.get(locale)
  if (cached) return cached
  const dateTime = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short'
  })
  const localization: EmailLocalization = {
    locale,
    dir: RIGHT_TO_LEFT.has(locale) ? 'rtl' : 'ltr',
    t: messages(locale),
    dateTime: (iso) => dateTime.format(new Date(iso)),
    storage: (bytes) => {
      const { unit, bytes: size } = STORAGE_UNITS.find((step) => bytes >= step.bytes) ?? {
        unit: 'byte',
        bytes: 1
      }
      return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit,
        unitDisplay: 'short',
        maximumFractionDigits: 1
      }).format(bytes / size)
    }
  }
  localizations.set(locale, localization)
  return localization
}

/** The language an `Accept-Language` header prefers among Cloud's, or null when it names none. */
export function acceptedLocale(header: string | null | undefined): CloudLocale | null {
  const languages = parseAccept(header ?? '')
    .filter((language) => language.q > 0)
    .map((language) => language.type)
  return matchCloudLocale(languages)
}
