import { join } from 'node:path'

import type { KitDefinition } from '../kit'
import { shadcnSources } from './sources'

/** shadcn/ui, as its CLI sets up a project on Radix with the nova style, in light and dark. */
export const SHADCN_KIT: KitDefinition = {
  name: 'shadcn/ui',
  page: join(import.meta.dir, 'page.tsx'),
  modes: [{ name: 'Light' }, { name: 'Dark', rootAttributes: { class: 'dark' } }],
  sources: shadcnSources,
  // shadcn's examples sit in its docs site's wrapper, which fills a screen; here they take the
  // room they need.
  css: '[data-slot="example-wrapper"] { min-height: 0; }'
}
