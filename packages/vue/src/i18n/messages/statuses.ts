import { count, params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const statusMessageDefaults = {
  status: 'Status',
  statuses: 'Statuses',
  addStatus: 'Add status',
  removeStatus: 'Remove status',
  editStatuses: 'Edit statuses…',
  mixed: 'Mixed',
  setFor: params('Set for {count} of {total} layers'),
  moveTo: 'Move to',
  hiddenInside: params('{state} is hidden while this layer is inside {layer}'),
  remove: 'Remove',
  presetHandoff: 'Figma handoff',
  presetSimple: 'Simple',
  presetReview: 'Design review',
  preset: 'Preset',
  custom: 'Custom',
  name: 'Name',
  color: 'Color',
  newStatus: 'New status',
  deleteStatus: 'Delete status',
  inUse: params('{state} is on {layers}. Move them to:'),
  noStatus: 'No status',
  figmaShows: params('Shows in Figma as {status}'),
  readyForDev: 'Ready for dev',
  completed: 'Completed',
  layerCount: count({ one: '{count} layer', many: '{count} layers' }),
  impactHeading: 'Applying changes what these layers show',
  restore: 'Restore',
  chooseWhere: 'Choose where the layers in each deleted status go',
  discardTitle: 'Discard changes to statuses?',
  discardDescription: 'The changes you made here have not been applied.',
  discard: 'Discard'
} as const

export const statusMessages = i18n('statuses', statusMessageDefaults)
