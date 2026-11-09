import { describe, expect, test } from 'bun:test'

import { credentialsMessages } from '@open-pencil/vue/i18n'

import { settingsErrorMessage } from '@/app/settings/credentials/errors'
import { CredentialStoreError } from '@/app/settings/credentials/types'

describe('settingsErrorMessage', () => {
  test('explains a credential store the app cannot use instead of its backend text', () => {
    const messages = credentialsMessages.get()
    const locked = new CredentialStoreError('locked', 'The system credential store is locked')
    const unavailable = new CredentialStoreError(
      'unavailable',
      'The system credential store is unavailable'
    )
    expect(settingsErrorMessage(locked)).toBe(messages.storeLocked)
    expect(settingsErrorMessage(unavailable)).toBe(messages.storeUnavailable)
  })

  test('keeps the message of any other failure', () => {
    expect(settingsErrorMessage(new CredentialStoreError('failed', 'Copy failed'))).toBe(
      'Copy failed'
    )
    expect(settingsErrorMessage(new Error('Bearer token required'))).toBe('Bearer token required')
    expect(settingsErrorMessage('timeout')).toBe('timeout')
  })
})
