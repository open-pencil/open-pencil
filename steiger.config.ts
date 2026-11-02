import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

import { lawhaArchitecturePlugin } from './tools/checks/architecture/src/steiger-rules/index.ts'

// Lawha is not laid out as canonical Feature-Sliced Design layers.
// Keep Steiger focused on project-specific architecture boundaries instead of
// enabling fsd.configs.recommended, which treats src/ and packages/ as FSD layer typos.
export default defineConfig([
  fsd.plugin,
  lawhaArchitecturePlugin,
  {
    ignores: [
      '.claude/**',
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
      'lawha/prefer-domain-folders-over-filename-prefixes': 'error',
      'lawha/strict-test-file-placement': 'error',
      'lawha/no-engine-only-assertions-in-e2e': 'error',
      'lawha/no-e2e-imports-in-engine-tests': 'error',
      'lawha/no-root-markdown-clutter': 'error',
      'lawha/no-prototype-or-generated-imports': 'error',
      'lawha/no-property-panel-imports-in-canvas': 'error',
      'lawha/no-app-imports-in-workspace-packages': 'error',
      'lawha/no-package-internals-in-app': 'error',
      'lawha/no-foreign-package-local-aliases': 'error',
      'lawha/no-app-imports-components-or-views': 'error',
      'lawha/no-components-import-views': 'error',
      'lawha/no-views-imported-outside-entry': 'error',
      'lawha/no-editor-imports-in-cloud-portal': 'error',
      'lawha/no-tailwind-variants-in-themes': 'error',
      'lawha/no-non-ui-imports-in-shared-ui': 'error',
      'lawha/no-app-imports-in-shared-ui': 'error',
      'lawha/no-property-panel-internals-outside-panel': 'error',
      'lawha/no-production-test-ids-in-shared-layers': 'error',
      'lawha/no-native-title-attributes-in-vue': 'error',
      'lawha/no-ui-imports-in-core': 'error',
      'lawha/no-graph-builders-in-front-ends': 'error',
      'lawha/scripts-are-entrypoint-shims': 'error',
      'lawha/strict-tools-layout': 'error',
      'lawha/unique-component-names': 'error',
      'lawha/multi-word-component-names': 'error'
    }
  }
])
