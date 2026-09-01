import { i18n } from '#vue/i18n/create'

export const recoveryMessageDefaults = {
  dialogTitle: 'Recover unsaved work',
  dialogDescription: 'OpenPencil found documents from a previous session.',
  restoreFailed: 'Could not restore this document.',
  settingsTitle: 'Recovery',
  settingsDescription: 'Control local crash-recovery copies for unsaved documents.',
  preserveUnsavedWork: 'Automatically preserve unsaved work',
  preserveUnsavedWorkDescription:
    'Store local recovery copies so documents can be restored after an unexpected shutdown.',
  restore: 'Restore',
  discard: 'Discard'
} as const

export const recoveryMessages = i18n('recovery', recoveryMessageDefaults)
