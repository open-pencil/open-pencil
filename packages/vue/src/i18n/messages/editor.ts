import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const editorMessageDefaults = {
  toolOptions: params('{tool} options'),
  removeGradientStop: 'Remove gradient stop',
  /** The word before a corner's radius in the label beside a dragged radius handle. */
  cornerRadius: 'Radius',
  showUI: params('Show UI ({shortcut})'),
  previewing: 'Previewing',
  startPreview: params('Preview ({shortcut})'),
  resetPreview: 'Reset',
  leavePreview: params('Leave preview ({shortcut})')
} as const

export const editorMessages = i18n('editor', editorMessageDefaults)
