import type en from './en.json'

export type LocaleCode = 'en' | 'zh-CN' | 'zh-TW' | 'fr' | 'ko' | 'ja' | 'de' | 'it' | 'ru'

export type LocaleSchema = typeof en

export const SUPPORTED_LOCALES: LocaleCode[] = [
  'en',
  'zh-CN',
  'zh-TW',
  'fr',
  'ko',
  'ja',
  'de',
  'it',
  'ru'
]

export const LOCALE_NAMES: Record<LocaleCode, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  fr: 'Français',
  ko: '한국어',
  ja: '日本語',
  de: 'Deutsch',
  it: 'Italiano',
  ru: 'Русский'
}

export const STORAGE_KEY = 'openpencil-language'