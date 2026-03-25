import { createI18n } from '@nanostores/i18n'

import { locale } from './locale'

import type { Locale } from './locale'
import type { ComponentsJSON } from '@nanostores/i18n'

export const i18n = createI18n<Locale, 'en'>(locale, {
  baseLocale: 'en',
  async get(code) {
    const mod = (await import(`../locales/${code}.json`)) as { default: ComponentsJSON }
    return mod.default
  }
})
