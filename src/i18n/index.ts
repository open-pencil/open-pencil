import { createI18n } from 'vue-i18n'
import { IS_BROWSER } from '@open-pencil/core'
import type { LocaleCode } from '../locales/types'
import { SUPPORTED_LOCALES, STORAGE_KEY, LOCALE_NAMES } from '../locales/types'

import en from '../locales/en.json'
import zhCN from '../locales/zh-CN.json'
import zhTW from '../locales/zh-TW.json'
import fr from '../locales/fr.json'
import ko from '../locales/ko.json'
import ja from '../locales/ja.json'
import de from '../locales/de.json'
import it from '../locales/it.json'
import ru from '../locales/ru.json'

export type MessageSchema = typeof en

function detectSystemLocale(): LocaleCode {
  if (!IS_BROWSER) return 'en'

  const browserLang = navigator.language

  if (browserLang.startsWith('zh')) {
    if (browserLang === 'zh-TW' || browserLang === 'zh-HK' || browserLang.startsWith('zh-Hant')) {
      return 'zh-TW'
    }
    return 'zh-CN'
  }

  const langCode = browserLang.split('-')[0]
  if (SUPPORTED_LOCALES.includes(langCode as LocaleCode)) {
    return langCode as LocaleCode
  }

  return 'en'
}

function getInitialLocale(): string {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && SUPPORTED_LOCALES.includes(saved as LocaleCode)) {
      return saved
    }
  }
  return detectSystemLocale()
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    zh: zhCN,
    fr,
    ko,
    ja,
    de,
    it,
    ru
  }
})

export function setLocale(locale: LocaleCode): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(i18n.global.locale as any).value = locale
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale)
  }
}

export function getLocale(): LocaleCode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (i18n.global.locale as any).value as LocaleCode
}

export { SUPPORTED_LOCALES, LOCALE_NAMES }
export type { LocaleCode, LocaleSchema } from '../locales/types'