import { defineConfig } from 'tsdown'

import { libraryConfig } from '@open-pencil/package-artifacts-tools/tsdown'

export default defineConfig(
  libraryConfig({
    entry: {
      index: './src/index.ts',
      recommended: './src/recommended.ts'
    },
  })
)
