import { createI18n, params } from '@nanostores/i18n'
import type { ComponentsJSON } from '@nanostores/i18n'
import { useStore } from '@nanostores/vue'

import { locale, type Locale, type TranslatedLocale } from '@open-pencil/vue'

export const notificationMessageDefaults = {
  chatInitializationFailed: params('Could not initialize chat: {error}'),
  linkCopied: 'Link copied to clipboard.',
  clipboardMissingDesignData: 'Clipboard does not contain design data.',
  clipboardAccessBlocked: 'Clipboard access is blocked in this browser context.',
  copiedAs: params('Copied as {format}.'),
  nodeID: 'node ID',
  nodeIDs: 'node IDs',
  xPath: 'XPath',
  xPaths: 'XPaths',
  pngClipboardUnavailable: 'PNG clipboard export is not available in this browser.',
  openFileFailed: params('Could not open “{name}”: {error}'),
  importedDOMCSS: 'Imported DOM/CSS document.',
  importDOMCSSFailed: params('Could not import DOM/CSS: {error}'),
  openDOMCSSFailed: params('Could not open DOM/CSS file: {error}'),
  vectorizeCredentialRequired: params('Add a {provider} API key in Settings → Media.'),
  vectorizeImageMissing: 'Image data is missing for this layer.',
  vectorizingImage: 'Vectorizing image…',
  imageConvertedToVectors: 'Image converted to vectors.',
  vectorizeCredentialFailed: params('{error}. Update it in Settings → Media.'),
  vectorizeFailed: params('{provider} could not vectorize this image: {error}'),
  operationFailed: params('Operation failed: {error}'),
  storageConnected: 'Connected. Storage namespace is ready.',
  storageConnectionFailed: params('Could not connect to storage: {error}')
} as const

const localeLoaders = {
  de: () => import('./locales/de.json'),
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
  it: () => import('./locales/it.json'),
  ja: () => import('./locales/ja.json'),
  pl: () => import('./locales/pl.json'),
  ru: () => import('./locales/ru.json'),
  'zh-CN': () => import('./locales/zh-cn.json')
} satisfies Record<TranslatedLocale, () => Promise<{ default: Record<string, string> }>>

const appI18n = createI18n<Locale, 'en'>(locale, {
  baseLocale: 'en',
  async get(code): Promise<ComponentsJSON> {
    if (code === 'en') return {}
    const loaded = await localeLoaders[code]()
    return { notifications: loaded.default }
  }
})

export const notificationMessages = appI18n('notifications', notificationMessageDefaults)

export function useNotificationMessages() {
  return useStore(notificationMessages)
}
