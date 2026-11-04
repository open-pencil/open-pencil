import { describe, expect, test } from 'bun:test'

import { resolveBrowserLocale } from '#vue/i18n/locale'

describe('browser locale matching', () => {
  test('matches a primary regional locale before secondary languages', () => {
    expect(resolveBrowserLocale(['en-US', 'it-IT', 'it', 'es-ES', 'es', 'en'])).toBe('en')
  })

  test('preserves browser language preference order', () => {
    expect(resolveBrowserLocale(['it-IT', 'en-US'])).toBe('it')
  })

  test('prefers exact supported regional locales', () => {
    expect(resolveBrowserLocale(['zh-CN', 'en-US'])).toBe('zh-CN')
    expect(resolveBrowserLocale(['ZH-cn', 'en-US'])).toBe('zh-CN')
  })

  test('reads a language in the script the locale is written in', () => {
    expect(resolveBrowserLocale(['zh'])).toBe('zh-CN')
    expect(resolveBrowserLocale(['zh-SG'])).toBe('zh-CN')
    expect(resolveBrowserLocale(['zh-Hans-HK'])).toBe('zh-CN')
    expect(resolveBrowserLocale(['zh-TW', 'fr-CA'])).toBe('fr')
    expect(resolveBrowserLocale(['zh-Hant'])).toBe('en')
  })

  test('matches Brazilian and European Portuguese to pt-BR', () => {
    expect(resolveBrowserLocale(['pt-BR', 'en-US'])).toBe('pt-BR')
    expect(resolveBrowserLocale(['pt-PT'])).toBe('pt-BR')
    expect(resolveBrowserLocale(['pt'])).toBe('pt-BR')
  })

  test('falls back to English when no locale matches', () => {
    expect(resolveBrowserLocale(['ko-KR'])).toBe('en')
  })
})
