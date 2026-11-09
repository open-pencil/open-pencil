import { readFileSync } from 'node:fs'

import { defineConfig } from 'tsdown'
import type { Rolldown } from 'tsdown'

import { libraryConfig } from '@open-pencil/package-artifacts-tools/tsdown'

function rawText(): Rolldown.Plugin {
  return {
    name: 'raw-text',
    load(id) {
      if (id.endsWith('?raw')) {
        const path = id.slice(0, -'?raw'.length)
        return `export default ${JSON.stringify(readFileSync(path, 'utf8'))}`
      }
    }
  }
}


export default defineConfig(
  libraryConfig({
    entry: {
      'schema-runtime': './src/schema-runtime/index.ts',
      fig: './src/fig/index.ts',
      'fig/codec': './src/fig/codec.ts',
      'fig/container': './src/fig/container.ts',
      'fig/guid': './src/fig/guid.ts',
      'fig/parse': './src/fig/parse.ts'
    },
    plugins: [rawText()]
  })
)
