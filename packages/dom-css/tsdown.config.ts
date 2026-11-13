import { defineConfig } from 'tsdown'

import { libraryConfig } from '@open-pencil/package-artifacts-tools/tsdown'

export default defineConfig(
  libraryConfig({
    entry: {
      index: './src/index.ts',
      browser: './src/browser.ts',
      export: './src/export/index.ts',
      'export/storybook/mapping/index': './src/export/storybook/mapping/index.ts',
      'scene-graph': './src/import/scene-graph.ts',
      'jsx-runtime': './src/import/jsx/runtime.ts',
      'jsx-dev-runtime': './src/import/jsx/dev-runtime.ts'
    }
  })
)
