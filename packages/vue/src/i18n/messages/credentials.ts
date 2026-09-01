import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const credentialsMessageDefaults = {
  storage: params('Credentials: {backend}'),
  backendNative: 'system credential store',
  backendBrowser: 'encrypted browser storage',
  backendMemory: 'this session only',
  remember: 'Remember credentials on this browser',
  savedReplace: 'Key saved — enter new to replace',
  getAPIKey: 'Get API key →'
} as const

export const credentialsMessages = i18n('credentials', credentialsMessageDefaults)
