import { i18n } from '#vue/i18n/create'

export const recoveryMessageDefaults = {
  dialogTitle: 'Recover unsaved work',
  dialogDescription: 'OpenPencil quit unexpectedly. These documents had unsaved changes.',
  sectionTitle: 'Unsaved work',
  sectionDescription:
    'Unsaved changes kept from documents closed without saving or open when OpenPencil quit. Open one to keep working on it.',
  restoreFailed: 'Could not restore this document.',
  discardFailed: 'Could not discard this copy.',
  settingsTitle: 'Recovery',
  settingsDescription: 'Control local crash-recovery copies for unsaved documents.',
  preserveUnsavedWork: 'Automatically preserve unsaved work',
  preserveUnsavedWorkDescription:
    'Store local recovery copies so documents can be restored after an unexpected shutdown.',
  restore: 'Restore',
  discard: 'Discard'
} as const

export const recoveryMessages = i18n('recovery', recoveryMessageDefaults)
