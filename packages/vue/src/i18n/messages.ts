import type { Messages, TranslationsJSON } from '@nanostores/i18n'
import { mapValues } from 'es-toolkit'

import { i18n } from '#vue/i18n/create'
import { aiMessageDefaults } from '#vue/i18n/messages/ai'
import { automationMessageDefaults } from '#vue/i18n/messages/automation'
import { cloudMessageDefaults } from '#vue/i18n/messages/cloud/editor'
import { cloudEmbedMessageDefaults } from '#vue/i18n/messages/cloud/embed'
import { cloudPortalMessageDefaults } from '#vue/i18n/messages/cloud/portal'
import { communityPortalMessageDefaults } from '#vue/i18n/messages/cloud/portal/community'
import { personPortalMessageDefaults } from '#vue/i18n/messages/cloud/portal/person'
import { planPortalMessageDefaults } from '#vue/i18n/messages/cloud/portal/plan'
import { requestPortalMessageDefaults } from '#vue/i18n/messages/cloud/portal/requests'
import { accessTokenPortalMessageDefaults } from '#vue/i18n/messages/cloud/portal/tokens'
import { codeMessageDefaults } from '#vue/i18n/messages/code'
import { collaborationMessageDefaults } from '#vue/i18n/messages/collaboration'
import { commandMessageDefaults } from '#vue/i18n/messages/commands'
import { commentMessageDefaults } from '#vue/i18n/messages/comments'
import { commonMessageDefaults } from '#vue/i18n/messages/common'
import { credentialsMessageDefaults } from '#vue/i18n/messages/credentials'
import { designCheckMessageDefaults } from '#vue/i18n/messages/design-check'
import { diagnosticsMessageDefaults } from '#vue/i18n/messages/diagnostics'
import { editorMessageDefaults } from '#vue/i18n/messages/editor'
import { figJamMessageDefaults } from '#vue/i18n/messages/figjam'
import { filesMessageDefaults } from '#vue/i18n/messages/files'
import { fontsMessageDefaults } from '#vue/i18n/messages/fonts'
import { mediaMessageDefaults } from '#vue/i18n/messages/media'
import { menuMessageDefaults } from '#vue/i18n/messages/menu'
import { pageMessageDefaults } from '#vue/i18n/messages/pages'
import { panelMessageDefaults } from '#vue/i18n/messages/panels'
import { behaviourPanelMessageDefaults } from '#vue/i18n/messages/panels/behaviours'
import { libraryPanelMessageDefaults } from '#vue/i18n/messages/panels/libraries'
import { pickerPanelMessageDefaults } from '#vue/i18n/messages/panels/pickers'
import { recoveryMessageDefaults } from '#vue/i18n/messages/recovery'
import { renameMessageDefaults } from '#vue/i18n/messages/rename'
import { settingsMessageDefaults } from '#vue/i18n/messages/settings'
import { shapeMessageDefaults } from '#vue/i18n/messages/shapes'
import { statusMessageDefaults } from '#vue/i18n/messages/statuses'
import { storageMessageDefaults } from '#vue/i18n/messages/storage'
import { toolMessageDefaults } from '#vue/i18n/messages/tools'
import { updatesMessageDefaults } from '#vue/i18n/messages/updates'
import { variablesMessageDefaults } from '#vue/i18n/messages/variables/panel'
import { variableTypeMessageDefaults } from '#vue/i18n/messages/variables/types'

/**
 * Every namespace's English messages, named by the path of its file under `messages/`, which is
 * also where each locale keeps its translations (`locales/<locale>/<namespace>.json`).
 */
export const messageDefaults = {
  ai: aiMessageDefaults,
  automation: automationMessageDefaults,
  'cloud/editor': cloudMessageDefaults,
  'cloud/embed': cloudEmbedMessageDefaults,
  'cloud/portal': cloudPortalMessageDefaults,
  'cloud/portal/community': communityPortalMessageDefaults,
  'cloud/portal/person': personPortalMessageDefaults,
  'cloud/portal/plan': planPortalMessageDefaults,
  'cloud/portal/requests': requestPortalMessageDefaults,
  'cloud/portal/tokens': accessTokenPortalMessageDefaults,
  code: codeMessageDefaults,
  collaboration: collaborationMessageDefaults,
  commands: commandMessageDefaults,
  comments: commentMessageDefaults,
  common: commonMessageDefaults,
  credentials: credentialsMessageDefaults,
  'design-check': designCheckMessageDefaults,
  diagnostics: diagnosticsMessageDefaults,
  editor: editorMessageDefaults,
  figjam: figJamMessageDefaults,
  files: filesMessageDefaults,
  fonts: fontsMessageDefaults,
  media: mediaMessageDefaults,
  menu: menuMessageDefaults,
  pages: pageMessageDefaults,
  panels: panelMessageDefaults,
  'panels/behaviours': behaviourPanelMessageDefaults,
  'panels/libraries': libraryPanelMessageDefaults,
  'panels/pickers': pickerPanelMessageDefaults,
  recovery: recoveryMessageDefaults,
  rename: renameMessageDefaults,
  settings: settingsMessageDefaults,
  shapes: shapeMessageDefaults,
  statuses: statusMessageDefaults,
  storage: storageMessageDefaults,
  tools: toolMessageDefaults,
  updates: updatesMessageDefaults,
  'variables/panel': variablesMessageDefaults,
  'variables/types': variableTypeMessageDefaults
} as const

export type MessageNamespace = keyof typeof messageDefaults

/** A locale's translations: a file for every namespace, each with some of its messages. */
export type LocaleTranslations = Record<MessageNamespace, TranslationsJSON>

type MessageStores = {
  readonly [Namespace in MessageNamespace]: Messages<(typeof messageDefaults)[Namespace]>
}

/** Each namespace's messages in the current locale, as a store. */
export const messageStores = mapValues(messageDefaults, (defaults, namespace) =>
  i18n(namespace, defaults)
) as MessageStores
