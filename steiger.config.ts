import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

import { openPencilArchitecturePlugin } from './scripts/steiger-rules.ts'

export default defineConfig([
  fsd.plugin,
  openPencilArchitecturePlugin,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'desktop/**',
      'public/**',
      'tests/**',
      'scratch/**',
      'demo-recordings/**'
    ]
  },
  {
    rules: {
      'open-pencil/no-property-panel-imports-in-canvas': 'error',
      'open-pencil/no-app-imports-in-workspace-packages': 'error',
      'open-pencil/no-package-internals-in-app': 'error',
      'open-pencil/no-foreign-package-local-aliases': 'error',
      'open-pencil/no-ui-imports-in-core': 'error'
    }
  }
])
