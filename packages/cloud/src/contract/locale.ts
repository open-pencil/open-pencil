import * as v from 'valibot'

/**
 * The languages Cloud writes to people in: the app's own, so an email reads like the app that
 * caused it. `check:i18n` keeps this list the same as the app's.
 */
export const CLOUD_LOCALES = [
  'en',
  'ar',
  'de',
  'es',
  'fr',
  'it',
  'ja',
  'pl',
  'pt-BR',
  'ru',
  'zh-CN'
] as const

export type CloudLocale = (typeof CLOUD_LOCALES)[number]

export const cloudLocaleSchema = v.picklist(CLOUD_LOCALES)

/** The language an account's email is written in, as the app last said it uses. */
export const cloudLocaleUpdateSchema = v.object({ locale: cloudLocaleSchema })

export function parseCloudLocaleUpdate(input: unknown) {
  return v.parse(cloudLocaleUpdateSchema, input)
}

export function isCloudLocale(value: unknown): value is CloudLocale {
  return v.is(cloudLocaleSchema, value)
}

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
 * The first of someone's languages Cloud writes in: the same tag, or the same language in the same
 * script, so `de-AT` reads German and `zh-TW`, written in Traditional, does not read Simplified.
 */
export function matchCloudLocale(languages: readonly string[]): CloudLocale | null {
  const byCode = new Map(CLOUD_LOCALES.map((code) => [code.toLowerCase(), code]))
  const byScript = new Map(CLOUD_LOCALES.map((code) => [languageScript(code), code]))
  for (const language of languages) {
    const match = byCode.get(language.toLowerCase()) ?? byScript.get(languageScript(language))
    if (match) return match
  }
  return null
}
