import { join } from 'node:path'

import type { Plugin } from 'vite'

import { REKA_ELEMENTS } from '@open-pencil/design-jsx'
import { COMPONENT_ATTRIBUTES } from '@open-pencil/dom-css/scene-graph'

import type { MarkAttributes } from './mark'

/** The module kits import Radix from, as shadcn/ui's components do. */
const RADIX = 'radix-ui'
const MARKED = '\0marked-radix'

/**
 * Serves kits a `radix-ui` whose parts mark themselves with the Reka UI element they are, as
 * Design JSX names them, so a page rendered from a kit's own components says which control each
 * is. Only the served module imports the real one.
 */
export function markedRadixPlugin(): Plugin {
  const parts = Object.fromEntries(
    Object.entries(REKA_ELEMENTS).map(([name, roles]) => [name, Object.keys(roles)])
  )
  const marks: MarkAttributes = {
    reka: COMPONENT_ATTRIBUTES.reka,
    behaviour: COMPONENT_ATTRIBUTES.behaviour
  }
  return {
    name: 'open-pencil:marked-radix',
    enforce: 'pre',
    resolveId(id, importer) {
      return id === RADIX && importer !== MARKED ? MARKED : undefined
    },
    load(id) {
      if (id !== MARKED) return undefined
      return [
        `import * as Radix from '${RADIX}'`,
        `import { markRadix } from ${JSON.stringify(join(import.meta.dir, 'mark.ts'))}`,
        `const marked = markRadix(Radix, ${JSON.stringify(parts)}, ${JSON.stringify(marks)})`,
        `export * from '${RADIX}'`,
        ...Object.keys(parts).map(
          (name) => `export const ${name} = marked.${name} ?? Radix.${name}`
        )
      ].join('\n')
    }
  }
}
