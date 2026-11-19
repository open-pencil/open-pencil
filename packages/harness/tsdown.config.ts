import { defineConfig } from 'tsdown'

import { libraryConfig } from '@open-pencil/package-artifacts-tools/tsdown'

export default defineConfig(
  libraryConfig({
    entry: {
      index: './src/index.ts',
      stdio: './src/stdio.ts'
    },
    // A Node program: chunks keep rolldown's hashed names, and nothing is shaken out.
    platform: 'node',
    treeshake: false,
    hash: true,
    chunks: 'default'
  })
)
