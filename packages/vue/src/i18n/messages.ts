import { aiMessageDefaults, aiMessages } from '#vue/i18n/messages/ai'
import { automationMessageDefaults, automationMessages } from '#vue/i18n/messages/automation'
import { codeMessageDefaults, codeMessages } from '#vue/i18n/messages/code'
import {
  collaborationMessageDefaults,
  collaborationMessages
} from '#vue/i18n/messages/collaboration'
import { commandMessageDefaults, commandMessages } from '#vue/i18n/messages/commands'
import { commonMessageDefaults, commonMessages } from '#vue/i18n/messages/common'
import { credentialsMessageDefaults, credentialsMessages } from '#vue/i18n/messages/credentials'
import { editorMessageDefaults, editorMessages } from '#vue/i18n/messages/editor'
import { filesMessageDefaults, filesMessages } from '#vue/i18n/messages/files'
import { fontsMessageDefaults, fontsMessages } from '#vue/i18n/messages/fonts'
import { mediaMessageDefaults, mediaMessages } from '#vue/i18n/messages/media'
import { menuMessageDefaults, menuMessages } from '#vue/i18n/messages/menu'
import { pageMessageDefaults, pageMessages } from '#vue/i18n/messages/pages'
import { panelMessageDefaults, panelMessages } from '#vue/i18n/messages/panels'
import { recoveryMessageDefaults, recoveryMessages } from '#vue/i18n/messages/recovery'
import { renameMessageDefaults, renameMessages } from '#vue/i18n/messages/rename'
import { settingsMessageDefaults, settingsMessages } from '#vue/i18n/messages/settings'
import { storageMessageDefaults, storageMessages } from '#vue/i18n/messages/storage'
import { toolMessageDefaults, toolMessages } from '#vue/i18n/messages/tools'
import { updatesMessageDefaults, updatesMessages } from '#vue/i18n/messages/updates'
import {
  variableTypeMessageDefaults,
  variableTypeMessages
} from '#vue/i18n/messages/variable-types'
import { variablesMessageDefaults, variablesMessages } from '#vue/i18n/messages/variables'

export {
  aiMessages,
  automationMessages,
  codeMessages,
  collaborationMessages,
  commandMessages,
  commonMessages,
  credentialsMessages,
  editorMessages,
  filesMessages,
  fontsMessages,
  mediaMessages,
  menuMessages,
  pageMessages,
  panelMessages,
  recoveryMessages,
  renameMessages,
  settingsMessages,
  storageMessages,
  toolMessages,
  updatesMessages,
  variablesMessages,
  variableTypeMessages
}

export const messageDefaults = {
  ai: aiMessageDefaults,
  automation: automationMessageDefaults,
  code: codeMessageDefaults,
  collaboration: collaborationMessageDefaults,
  commands: commandMessageDefaults,
  common: commonMessageDefaults,
  credentials: credentialsMessageDefaults,
  editor: editorMessageDefaults,
  files: filesMessageDefaults,
  fonts: fontsMessageDefaults,
  media: mediaMessageDefaults,
  menu: menuMessageDefaults,
  pages: pageMessageDefaults,
  panels: panelMessageDefaults,
  recovery: recoveryMessageDefaults,
  rename: renameMessageDefaults,
  settings: settingsMessageDefaults,
  storage: storageMessageDefaults,
  tools: toolMessageDefaults,
  updates: updatesMessageDefaults,
  variables: variablesMessageDefaults,
  variableTypes: variableTypeMessageDefaults
} as const
