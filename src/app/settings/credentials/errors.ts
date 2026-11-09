import { credentialsMessages } from '@open-pencil/vue/i18n'

import { CredentialStoreError } from '@/app/settings/credentials/types'

/**
 * The text a settings form shows for a failed save: what to do when the system credential store
 * is locked or out of reach, otherwise the error's own message.
 */
export function settingsErrorMessage(cause: unknown): string {
  if (cause instanceof CredentialStoreError) {
    const messages = credentialsMessages.get()
    if (cause.code === 'locked') return messages.storeLocked
    if (cause.code === 'unavailable') return messages.storeUnavailable
  }
  return cause instanceof Error ? cause.message : String(cause)
}
