import { commandMessageDefaults } from '#vue/i18n/messages/commands'
import { dialogMessageDefaults } from '#vue/i18n/messages/dialogs'
import { menuMessageDefaults } from '#vue/i18n/messages/menu'
import { pageMessageDefaults } from '#vue/i18n/messages/pages'
import { panelMessageDefaults } from '#vue/i18n/messages/panels'
import { toolMessageDefaults } from '#vue/i18n/messages/tools'
import { variableTypeMessageDefaults } from '#vue/i18n/messages/variable-types'

export { menuMessages, menuMessageDefaults } from '#vue/i18n/messages/menu'
export { commandMessages, commandMessageDefaults } from '#vue/i18n/messages/commands'
export { toolMessages, toolMessageDefaults } from '#vue/i18n/messages/tools'
export { panelMessages, panelMessageDefaults } from '#vue/i18n/messages/panels'
export {
  variableTypeMessages,
  variableTypeMessageDefaults
} from '#vue/i18n/messages/variable-types'
export { pageMessages, pageMessageDefaults } from '#vue/i18n/messages/pages'
export { dialogMessages, dialogMessageDefaults } from '#vue/i18n/messages/dialogs'

export const messageDefaults = {
  menu: menuMessageDefaults,
  commands: commandMessageDefaults,
  tools: toolMessageDefaults,
  panels: panelMessageDefaults,
  variableTypes: variableTypeMessageDefaults,
  pages: pageMessageDefaults,
  dialogs: dialogMessageDefaults
} as const
