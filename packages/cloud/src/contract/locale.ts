import * as v from 'valibot'

/** Whether `tag` is a well-formed BCP 47 language tag: `de`, `pt-BR`, `zh-Hant-TW`. */
function isLanguageTag(tag: string): boolean {
  try {
    return Intl.getCanonicalLocales(tag).length === 1
  } catch {
    return false
  }
}

/**
 * A language as the app names it, which the server writes email in when it has that language, or
 * the nearest it has, and otherwise in English.
 */
export const cloudLanguageTagSchema = v.pipe(
  v.string(),
  v.maxLength(35),
  v.check(isLanguageTag, 'Not a language tag')
)

/** The language an account's email is written in, as the app last said it uses. */
export const cloudLocaleUpdateSchema = v.object({ locale: cloudLanguageTagSchema })

export function parseCloudLocaleUpdate(input: unknown) {
  return v.parse(cloudLocaleUpdateSchema, input)
}
