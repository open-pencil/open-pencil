import { defineConfig } from 'tsdown'

import { libraryConfig } from '@open-pencil/package-artifacts-tools/tsdown'

export default defineConfig(
  libraryConfig({
    entry: {
      index: './src/index.ts',
      'instance-overrides': './src/instance-overrides/index.ts',
      clipboard: './src/clipboard/index.ts',
      'node-change': './src/node-change/index.ts'
    },
    // Rolldown's own chunk grouping, which the package has always shipped with.
    chunks: 'default'
  })
)
