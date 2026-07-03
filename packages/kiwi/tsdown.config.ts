import { readFileSync } from 'node:fs'

import { defineConfig } from 'tsdown'
import type { Rolldown } from 'tsdown'

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

export default defineConfig({
  entry: {
    index: './src/index.ts',
    'schema-runtime': './src/schema-runtime/index.ts',
    fig: './src/fig/index.ts',
    'fig/codec': './src/fig/codec.ts',
    'fig/container': './src/fig/container.ts',
    'fig/guid': './src/fig/guid.ts',
    'fig/parse': './src/fig/parse.ts'
  },
  plugins: [rawText()],
  platform: 'neutral',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  hash: false,
  clean: true,
  outDir: './dist',
  treeshake: {
    moduleSideEffects: false
  },
  deps: {
    neverBundle: [/^node:/],
    onlyBundle: false
  },
  outputOptions: {
    minifyInternalExports: false,
    codeSplitting: {
      groups: [
        {
          test: /(?<!\.d\.c?ts)$/,
          name: (id) => {
            const cleanId = id.split('?')[0]
            const parts = cleanId.split(/[\\/]/g)
            const srcIndex = parts.lastIndexOf('src')
            const file = srcIndex >= 0 ? parts.slice(srcIndex + 1).join('/') : parts.at(-1) ?? 'chunk'
            return `chunks/${file.replace(/\.(ts|tsx)$/, '')}`
          }
        }
      ]
    }
  }
})
