import { defineConfig } from 'tsdown'

import { libraryConfig } from '@open-pencil/package-artifacts-tools/tsdown'

export default defineConfig(
  libraryConfig({
    entry: {
      timing: './src/timing.ts',
      random: './src/random.ts',
      arrays: './src/arrays.ts',
      json: './src/json.ts'
    }
  })
)
