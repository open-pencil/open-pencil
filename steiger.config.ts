import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

import { inklyArchitecturePlugin } from './scripts/steiger-rules.ts'

// Inkly is not laid out as canonical Feature-Sliced Design layers.
// Keep Steiger focused on project-specific architecture boundaries instead of
// enabling fsd.configs.recommended, which treats src/ and packages/ as FSD layer typos.
export default defineConfig([
  fsd.plugin,
  inklyArchitecturePlugin,
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
      'inkly/prefer-domain-folders-over-filename-prefixes': 'error',
      'inkly/strict-test-file-placement': 'error',
      'inkly/no-engine-only-assertions-in-e2e': 'error',
      'inkly/no-e2e-imports-in-engine-tests': 'error',
      'inkly/no-root-markdown-clutter': 'error',
      'inkly/no-prototype-or-generated-imports': 'error',
      'inkly/no-property-panel-imports-in-canvas': 'error',
      'inkly/no-app-imports-in-workspace-packages': 'error',
      'inkly/no-package-internals-in-app': 'error',
      'inkly/no-foreign-package-local-aliases': 'error',
      'inkly/no-app-imports-components-or-views': 'error',
      'inkly/no-components-import-views': 'error',
      'inkly/no-views-imported-outside-entry': 'error',
      'inkly/no-non-ui-imports-in-shared-ui': 'error',
      'inkly/no-app-imports-in-shared-ui': 'error',
      'inkly/no-property-panel-internals-outside-panel': 'error',
      'inkly/no-ui-imports-in-core': 'error'
    }
  }
])
