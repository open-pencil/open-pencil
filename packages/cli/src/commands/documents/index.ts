import { defineCommand } from 'citty'

import { activate, close, create, open, save } from './files'
import list from './list'

export default defineCommand({
  meta: { description: 'List, open, create, save, close, and switch documents in the running app' },
  subCommands: { list, open, new: create, save, close, activate }
})
