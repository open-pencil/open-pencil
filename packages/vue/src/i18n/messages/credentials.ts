import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const credentialsMessageDefaults = {
  credentialStorage: params('Credentials: {backend}'),
  credentialBackendNative: 'system credential store',
  credentialBackendBrowser: 'encrypted browser storage',
  credentialBackendMemory: 'this session only',
  rememberCredentials: 'Remember credentials on this browser',
  keySavedReplace: 'Key saved — enter new to replace',
  getAPIKeyGeneric: 'Get API key →'
} as const

export const credentialsMessages = i18n('credentials', credentialsMessageDefaults)
