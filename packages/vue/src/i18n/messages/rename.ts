import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const renameMessageDefaults = {
  rename: 'Rename',
  renameLayers: params('Rename {count} layers'),
  renamePreview: 'Preview',
  renameMatch: 'Match',
  renameTo: 'Rename to',
  renameCurrentName: 'Current name',
  renameNumberAscending: 'Number ↑',
  renameNumberDescending: 'Number ↓',
  renameStartAscendingFrom: 'Start ascending from',
  renameStopDescendingAt: 'Stop descending at',
  renameInvalidPattern: 'Invalid regular expression'
} as const

export const renameMessages = i18n('rename', renameMessageDefaults)
