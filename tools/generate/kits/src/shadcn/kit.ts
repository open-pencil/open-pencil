import { join } from 'node:path'

import type { KitDefinition } from '../kit'
import { SHADCN_UPSTREAM } from './components'

/** shadcn/ui, as its CLI sets up a project on Radix with the nova style, in light and dark. */
export const SHADCN_KIT: KitDefinition = {
  name: 'shadcn/ui',
  root: import.meta.dir,
  page: '/page.tsx',
  stylesheet: join(SHADCN_UPSTREAM, 'index.css'),
  modes: [{ name: 'Light' }, { name: 'Dark', rootAttributes: { class: 'dark' } }]
}
