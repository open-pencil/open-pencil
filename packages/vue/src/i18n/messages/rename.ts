import { params } from '@nanostores/i18n'

export const renameMessageDefaults = {
  title: 'Rename',
  layers: params('Rename {count} layers'),
  preview: 'Preview',
  match: 'Match',
  to: 'Rename to',
  currentName: 'Current name',
  layerName: 'Layer name',
  numberAscending: 'Number ↑',
  numberDescending: 'Number ↓',
  startAscendingFrom: 'Start ascending from',
  stopDescendingAt: 'Stop descending at',
  invalidPattern: 'Invalid regular expression'
} as const
