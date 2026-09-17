import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { MENU_ARTIFACTS } from './menu'

for (const [path, render] of Object.entries(MENU_ARTIFACTS)) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, render())
}
