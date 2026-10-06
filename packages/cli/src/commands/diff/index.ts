import { defineCommand } from 'citty'

import apply from './apply'
import create from './create'
import files from './files'
import jsx from './jsx'
import show from './show'
import visual from './visual'

export default defineCommand({
  meta: { description: 'Compare nodes and documents, and apply property patches' },
  subCommands: {
    create,
    jsx,
    show,
    apply,
    visual,
    files
  }
})
