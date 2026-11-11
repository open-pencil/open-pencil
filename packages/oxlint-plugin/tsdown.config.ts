import { defineConfig } from 'tsdown'

import { libraryConfig } from '@open-pencil/package-artifacts-tools/tsdown'

export default defineConfig(
  libraryConfig({
    entry: {
      'plugins/data': './src/plugins/data.ts',
      'plugins/imports': './src/plugins/imports.ts',
      'plugins/runtime': './src/plugins/runtime.ts',
      'plugins/security': './src/plugins/security.ts',
      'plugins/structure': './src/plugins/structure.ts',
      'plugins/types': './src/plugins/types.ts',
      recommended: './src/recommended.ts'
    },
  })
)
