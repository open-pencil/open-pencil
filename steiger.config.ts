import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

import { openPencilArchitecturePlugin } from './scripts/steiger-rules.ts'

// OpenPencil is not laid out as canonical Feature-Sliced Design layers.
// Keep Steiger focused on project-specific architecture boundaries instead of
// enabling fsd.configs.recommended, which treats src/ and packages/ as FSD layer typos.
export default defineConfig([
  fsd.plugin,
  openPencilArchitecturePlugin,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'desktop/**',
      'public/**',
      'scratch/**',
      'demo-recordings/**'
    ]
  },
  {
    rules: {
      'open-pencil/prefer-domain-folders-over-filename-prefixes': 'error',
      'open-pencil/strict-test-file-placement': 'error',
      'open-pencil/no-engine-only-assertions-in-e2e': 'error',
      'open-pencil/no-e2e-imports-in-engine-tests': 'error',
      'open-pencil/no-root-markdown-clutter': 'error',
      'open-pencil/no-prototype-or-generated-imports': 'error',
      'open-pencil/no-property-panel-imports-in-canvas': 'error',
      'open-pencil/no-app-imports-in-workspace-packages': 'error',
      'open-pencil/no-package-internals-in-app': 'error',
      'open-pencil/no-foreign-package-local-aliases': 'error',
      'open-pencil/no-app-imports-components-or-views': 'error',
      'open-pencil/no-components-import-views': 'error',
      'open-pencil/no-views-imported-outside-entry': 'error',
      'open-pencil/no-non-ui-imports-in-shared-ui': 'error',
      'open-pencil/no-app-imports-in-shared-ui': 'error',
      'open-pencil/no-property-panel-internals-outside-panel': 'error',
      'open-pencil/no-ui-imports-in-core': 'error'
    }
  }
])
