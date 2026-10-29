import { aiMessageDefaults, aiMessages } from '#vue/i18n/messages/ai'
import { automationMessageDefaults, automationMessages } from '#vue/i18n/messages/automation'
import { cloudMessageDefaults, cloudMessages } from '#vue/i18n/messages/cloud/editor'
import { cloudPortalMessageDefaults, cloudPortalMessages } from '#vue/i18n/messages/cloud/portal'
import { codeMessageDefaults, codeMessages } from '#vue/i18n/messages/code'
import {
  collaborationMessageDefaults,
  collaborationMessages
} from '#vue/i18n/messages/collaboration'
import { commandMessageDefaults, commandMessages } from '#vue/i18n/messages/commands'
import { commentMessageDefaults, commentMessages } from '#vue/i18n/messages/comments'
import { commonMessageDefaults, commonMessages } from '#vue/i18n/messages/common'
import { credentialsMessageDefaults, credentialsMessages } from '#vue/i18n/messages/credentials'
import { designCheckMessageDefaults, designCheckMessages } from '#vue/i18n/messages/design-check'
import { diagnosticsMessageDefaults, diagnosticsMessages } from '#vue/i18n/messages/diagnostics'
import { editorMessageDefaults, editorMessages } from '#vue/i18n/messages/editor'
import { figJamMessageDefaults, figJamMessages } from '#vue/i18n/messages/figjam'
import { filesMessageDefaults, filesMessages } from '#vue/i18n/messages/files'
import { fontsMessageDefaults, fontsMessages } from '#vue/i18n/messages/fonts'
import { mediaMessageDefaults, mediaMessages } from '#vue/i18n/messages/media'
import { menuMessageDefaults, menuMessages } from '#vue/i18n/messages/menu'
import { pageMessageDefaults, pageMessages } from '#vue/i18n/messages/pages'
import { panelMessageDefaults, panelMessages } from '#vue/i18n/messages/panels'
import { recoveryMessageDefaults, recoveryMessages } from '#vue/i18n/messages/recovery'
import { renameMessageDefaults, renameMessages } from '#vue/i18n/messages/rename'
import { renderingMessageDefaults, renderingMessages } from '#vue/i18n/messages/rendering'
import { settingsMessageDefaults, settingsMessages } from '#vue/i18n/messages/settings'
import { shapeMessageDefaults, shapeMessages } from '#vue/i18n/messages/shapes'
import { statusMessageDefaults, statusMessages } from '#vue/i18n/messages/statuses'
import { storageMessageDefaults, storageMessages } from '#vue/i18n/messages/storage'
import { toolMessageDefaults, toolMessages } from '#vue/i18n/messages/tools'
import { updatesMessageDefaults, updatesMessages } from '#vue/i18n/messages/updates'
import { variablesMessageDefaults, variablesMessages } from '#vue/i18n/messages/variables/panel'
import {
  variableTypeMessageDefaults,
  variableTypeMessages
} from '#vue/i18n/messages/variables/types'

export {
  aiMessages,
  automationMessages,
  codeMessages,
  collaborationMessages,
  commandMessages,
  commentMessages,
  commonMessages,
  credentialsMessages,
  designCheckMessages,
  diagnosticsMessages,
  editorMessages,
  figJamMessages,
  filesMessages,
  fontsMessages,
  mediaMessages,
  menuMessages,
  pageMessages,
  panelMessages,
  recoveryMessages,
  renderingMessages,
  renameMessages,
  settingsMessages,
  shapeMessages,
  statusMessages,
  storageMessages,
  toolMessages,
  updatesMessages,
  cloudMessages,
  cloudPortalMessages,
  variablesMessages,
  variableTypeMessages
}

export const messageDefaults = {
  ai: aiMessageDefaults,
  automation: automationMessageDefaults,
  code: codeMessageDefaults,
  collaboration: collaborationMessageDefaults,
  commands: commandMessageDefaults,
  comments: commentMessageDefaults,
  common: commonMessageDefaults,
  credentials: credentialsMessageDefaults,
  designCheck: designCheckMessageDefaults,
  diagnostics: diagnosticsMessageDefaults,
  editor: editorMessageDefaults,
  figjam: figJamMessageDefaults,
  files: filesMessageDefaults,
  fonts: fontsMessageDefaults,
  media: mediaMessageDefaults,
  menu: menuMessageDefaults,
  pages: pageMessageDefaults,
  panels: panelMessageDefaults,
  recovery: recoveryMessageDefaults,
  rendering: renderingMessageDefaults,
  rename: renameMessageDefaults,
  settings: settingsMessageDefaults,
  shapes: shapeMessageDefaults,
  statuses: statusMessageDefaults,
  storage: storageMessageDefaults,
  tools: toolMessageDefaults,
  updates: updatesMessageDefaults,
  cloud: cloudMessageDefaults,
  cloudPortal: cloudPortalMessageDefaults,
  variables: variablesMessageDefaults,
  variableTypes: variableTypeMessageDefaults
} as const
