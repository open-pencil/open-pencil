import { defineConfig } from 'tsdown'
import raw from 'unplugin-raw/rolldown'

import { libraryConfig } from '@open-pencil/package-artifacts-tools/tsdown'

export default defineConfig(
  libraryConfig({
    entry: {
      index: './src/index.ts',
      'jsx-runtime': './src/jsx-runtime.ts',
      'jsx-dev-runtime': './src/jsx-dev-runtime.ts'
    },
    // `reference/index.ts` imports the authoring guide as text.
    plugins: [raw()]
  })
)
