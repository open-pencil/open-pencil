import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const editorMessageDefaults = {
  toolOptions: params('{tool} options'),
  removeGradientStop: 'Remove gradient stop',
  showUI: params('Show UI ({shortcut})')
} as const

export const editorMessages = i18n('editor', editorMessageDefaults)
