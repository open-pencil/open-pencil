import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ensureDemoDocument } from '@open-pencil/demo-tools'

/** An example the gallery shows: its document's name there, and how to build its file. */
export type ExampleSource = { name: string; build(root: string): Promise<Uint8Array> }

/**
 * The examples the gallery publishes, each a document of its own under this name. The tour is the
 * editor's demo document, built from its sources as the app's build does.
 */
export const EXAMPLES: ExampleSource[] = [
  {
    name: 'Welcome tour',
    async build(root) {
      await ensureDemoDocument({ root })
      return new Uint8Array(await readFile(join(root, 'public/demo.fig')))
    }
  }
]
