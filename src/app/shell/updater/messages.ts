import type { useI18n } from '@open-pencil/vue'

export type UpdaterMessages = ReturnType<typeof useI18n>['updates']['value']

export type UpdateFailureStep = 'check' | 'download' | 'install' | 'restart'

/** Translated text for an updater failure; a missing manifest means no signed release yet. */
export function updateFailureText(
  messages: UpdaterMessages,
  step: UpdateFailureStep,
  error: string
): string {
  if (step === 'download') return messages.downloadFailed({ error })
  if (step === 'install') return messages.installFailed({ error })
  if (step === 'restart') return messages.restartFailed({ error })
  if (error.toLowerCase().includes('valid release json')) return messages.unavailable
  return messages.checkFailed({ error })
}
