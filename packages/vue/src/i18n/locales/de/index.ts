import type { ComponentsJSON } from '@nanostores/i18n'

import commands from './commands.json'
import dialogs from './dialogs.json'
import menu from './menu.json'
import pages from './pages.json'
import panels from './panels.json'
import tools from './tools.json'
import variableTypes from './variable-types.json'

export default {
  menu: menu,
  commands: commands,
  tools: tools,
  panels: panels,
  variableTypes: variableTypes,
  pages: pages,
  dialogs: dialogs
} satisfies ComponentsJSON
