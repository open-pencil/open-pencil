import { i18n } from '#vue/i18n/create'

export const recoveryMessageDefaults = {
  recoverUnsavedWork: 'Recover unsaved work',
  recoverUnsavedWorkDescription: 'OpenPencil found documents from a previous session.',
  recoveryFailed: 'Could not restore this document.',
  settingsRecovery: 'Recovery',
  settingsRecoveryDescription: 'Control local crash-recovery copies for unsaved documents.',
  preserveUnsavedWork: 'Automatically preserve unsaved work',
  preserveUnsavedWorkDescription:
    'Store local recovery copies so documents can be restored after an unexpected shutdown.'
} as const

export const recoveryMessages = i18n('recovery', recoveryMessageDefaults)
