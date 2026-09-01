import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const renameMessageDefaults = {
  title: 'Rename',
  layers: params('Rename {count} layers'),
  preview: 'Preview',
  match: 'Match',
  to: 'Rename to',
  currentName: 'Current name',
  numberAscending: 'Number ↑',
  numberDescending: 'Number ↓',
  startAscendingFrom: 'Start ascending from',
  stopDescendingAt: 'Stop descending at',
  invalidPattern: 'Invalid regular expression'
} as const

export const renameMessages = i18n('rename', renameMessageDefaults)
