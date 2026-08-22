import { i18n } from '#vue/i18n/create'

export const variablesMessageDefaults = {
  createCollection: 'Create collection',
  renameCollection: 'Rename collection',
  deleteCollection: 'Delete collection',
  localVariables: 'Local variables',
  noVariableCollections: 'No variable collections',
  modes: 'Modes',
  addMode: 'Add mode',
  renameMode: 'Rename mode',
  duplicateMode: 'Duplicate mode',
  deleteMode: 'Delete mode',
  setDefaultMode: 'Set as default'
} as const

export const variablesMessages = i18n('variables', variablesMessageDefaults)
