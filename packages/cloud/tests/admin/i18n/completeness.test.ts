import { describe, expect, test } from 'bun:test'

import de from '#admin/i18n/locales/de'
import es from '#admin/i18n/locales/es'
import fr from '#admin/i18n/locales/fr'
import it from '#admin/i18n/locales/it'
import ja from '#admin/i18n/locales/ja'
import pl from '#admin/i18n/locales/pl'
import ru from '#admin/i18n/locales/ru'
import zhCN from '#admin/i18n/locales/zh-cn'
import {
  accountMessageDefaults,
  adminMessageDefaults,
  authMessageDefaults,
  commonMessageDefaults,
  errorMessageDefaults,
  headMessageDefaults,
  publicMessageDefaults
} from '#admin/i18n/messages'

const defaults = {
  common: commonMessageDefaults,
  public: publicMessageDefaults,
  auth: authMessageDefaults,
  account: accountMessageDefaults,
  admin: adminMessageDefaults,
  errors: errorMessageDefaults,
  head: headMessageDefaults
}
const locales = { de, es, fr, it, ja, pl, ru, 'zh-CN': zhCN }

function sourceText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'input' in value && typeof value.input === 'string') {
    return value.input
  }
  throw new TypeError('Unexpected source translation')
}
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort()
}

describe('Cloud admin translations', () => {
  test('preserves keys, placeholders, brands, and clean text in every locale', () => {
    for (const [locale, translations] of Object.entries(locales)) {
      for (const [namespace, source] of Object.entries(defaults)) {
        expect(Object.keys(translations[namespace as keyof typeof translations]).sort()).toEqual(
          Object.keys(source).sort()
        )
        for (const [key, raw] of Object.entries(source)) {
          const translated: string =
            translations[namespace as keyof typeof translations][key as never]
          expect(translated, `${locale}.${namespace}.${key}`).not.toContain('ZXOP')
          expect(translated, `${locale}.${namespace}.${key}`).not.toContain('&#')
          expect(translated, `${locale}.${namespace}.${key}`).not.toContain(String.fromCharCode(13))
          expect(placeholders(translated)).toEqual(placeholders(sourceText(raw)))
          for (const brand of ['OpenPencil', 'PostgreSQL', 'S3']) {
            if (sourceText(raw).includes(brand)) expect(translated).toContain(brand)
          }
        }
      }
    }
  })

  test('rejects known out-of-domain translation artifacts', () => {
    const content = JSON.stringify(locales)
    expect(content).not.toMatch(/student|Student|Clubzugang|烟火行动|آنبن|REJECT AREA/u)
  })
})
