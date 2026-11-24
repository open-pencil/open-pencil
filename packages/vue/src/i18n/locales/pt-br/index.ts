import type { LocaleTranslations } from '#vue/i18n/messages'

import ai from './ai.json'
import automation from './automation.json'
import cloudEditor from './cloud/editor.json'
import cloudPortal from './cloud/portal.json'
import cloudPortalCommunity from './cloud/portal/community.json'
import cloudPortalPerson from './cloud/portal/person.json'
import cloudPortalPlan from './cloud/portal/plan.json'
import cloudPortalRequests from './cloud/portal/requests.json'
import cloudPortalTokens from './cloud/portal/tokens.json'
import code from './code.json'
import collaboration from './collaboration.json'
import commands from './commands.json'
import comments from './comments.json'
import common from './common.json'
import credentials from './credentials.json'
import designCheck from './design-check.json'
import diagnostics from './diagnostics.json'
import editor from './editor.json'
import figjam from './figjam.json'
import files from './files.json'
import fonts from './fonts.json'
import media from './media.json'
import menu from './menu.json'
import pages from './pages.json'
import panels from './panels.json'
import panelsBehaviours from './panels/behaviours.json'
import panelsLibraries from './panels/libraries.json'
import panelsPickers from './panels/pickers.json'
import recovery from './recovery.json'
import rename from './rename.json'
import settings from './settings.json'
import shapes from './shapes.json'
import statuses from './statuses.json'
import storage from './storage.json'
import tools from './tools.json'
import updates from './updates.json'
import variablesEasing from './variables/easing.json'
import variablesPanel from './variables/panel.json'
import variablesTypes from './variables/types.json'

export default {
  ai,
  automation,
  'cloud/editor': cloudEditor,
  'cloud/portal': cloudPortal,
  'cloud/portal/community': cloudPortalCommunity,
  'cloud/portal/person': cloudPortalPerson,
  'cloud/portal/plan': cloudPortalPlan,
  'cloud/portal/requests': cloudPortalRequests,
  'cloud/portal/tokens': cloudPortalTokens,
  code,
  collaboration,
  commands,
  comments,
  common,
  credentials,
  'design-check': designCheck,
  diagnostics,
  editor,
  figjam,
  files,
  fonts,
  media,
  menu,
  pages,
  panels,
  'panels/behaviours': panelsBehaviours,
  'panels/libraries': panelsLibraries,
  'panels/pickers': panelsPickers,
  recovery,
  rename,
  settings,
  shapes,
  statuses,
  storage,
  tools,
  updates,
  'variables/easing': variablesEasing,
  'variables/panel': variablesPanel,
  'variables/types': variablesTypes
} satisfies LocaleTranslations
