import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const credentialsMessageDefaults = {
  checkFailed: 'Could not check access to saved credentials.',
  retryCheck: 'Retry check',
  retryAccess: 'Retry access',
  settingsTitle: 'Saved passwords and API keys',
  accessPaused: 'Access to saved credentials is paused.',
  rememberDevice: 'Remember API keys on this device',
  sessionOnly: 'Keys are kept only until you close this session.',
  retryFailed: 'Could not reset credential access. Try again.',
  storage: params('Credentials: {backend}'),
  backendNative: 'system credential store',
  backendBrowser: 'encrypted browser storage',
  backendMemory: 'this session only',
  remember: 'Remember credentials on this browser',
  savedReplace: 'Key saved — enter new to replace',
  getAPIKey: 'Get API key →'
} as const

export const credentialsMessages = i18n('credentials', credentialsMessageDefaults)
