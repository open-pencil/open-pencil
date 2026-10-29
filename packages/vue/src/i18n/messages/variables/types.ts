import { i18n } from '#vue/i18n/create'

export const variableTypeMessageDefaults = {
  color: 'Color',
  colorHint: 'Paint values',
  number: 'Number',
  numberHint: 'Sizes, spacing, opacity',
  text: 'Text',
  textHint: 'Copy and labels',
  boolean: 'Boolean',
  booleanHint: 'True or false'
} as const

export const variableTypeMessages = i18n('variableTypes', variableTypeMessageDefaults)
