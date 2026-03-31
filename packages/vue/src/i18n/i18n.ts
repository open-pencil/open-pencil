import { createI18n } from '@nanostores/i18n'

import { locale } from './locale'

import type { Locale } from './locale'
import type { ComponentsJSON } from '@nanostores/i18n'

const localeLoaders: Record<Exclude<Locale, 'en'>, () => Promise<{ default: ComponentsJSON }>> = {
  de: () => import('../locales/de.json'),
  es: () => import('../locales/es.json'),
  fr: () => import('../locales/fr.json'),
  it: () => import('../locales/it.json'),
  pl: () => import('../locales/pl.json'),
  ru: () => import('../locales/ru.json'),
  'zh-CN': () => import('../locales/zh-CN.json')
}

export const i18n = createI18n<Locale, 'en'>(locale, {
  baseLocale: 'en',
  async get(code) {
    if (code === 'en') return {}
    const mod = await localeLoaders[code]()
    return mod.default
  }
})
