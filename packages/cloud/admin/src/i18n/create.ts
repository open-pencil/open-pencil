import { createI18n, type ComponentsJSON } from '@nanostores/i18n'

import { cloudLocale, type CloudLocale, type TranslatedCloudLocale } from './locale'
import {
  accountMessageDefaults,
  adminMessageDefaults,
  authMessageDefaults,
  commonMessageDefaults,
  errorMessageDefaults,
  headMessageDefaults,
  publicMessageDefaults
} from './messages'

const localeLoaders = {
  de: () => import('./locales/de'),
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
  it: () => import('./locales/it'),
  ja: () => import('./locales/ja'),
  pl: () => import('./locales/pl'),
  ru: () => import('./locales/ru'),
  'zh-CN': () => import('./locales/zh-cn')
} satisfies Record<TranslatedCloudLocale, () => Promise<{ default: ComponentsJSON }>>

export const cloudI18n = createI18n<CloudLocale, 'en'>(cloudLocale, {
  baseLocale: 'en',
  async get(code) {
    if (code === 'en') return {}
    return (await localeLoaders[code]()).default
  }
})

export const commonMessages = cloudI18n('common', commonMessageDefaults)
export const publicMessages = cloudI18n('public', publicMessageDefaults)
export const authMessages = cloudI18n('auth', authMessageDefaults)
export const accountMessages = cloudI18n('account', accountMessageDefaults)
export const adminMessages = cloudI18n('admin', adminMessageDefaults)
export const errorMessages = cloudI18n('errors', errorMessageDefaults)
export const headMessages = cloudI18n('head', headMessageDefaults)
