import { describe, expect, test } from 'bun:test'

import { lintFiles, ruleDiagnostics } from './helpers/lint.ts'

describe('no-inline-tauri-imports', () => {
  const rule = 'no-inline-tauri-imports'
  const rules = { [`open-pencil/${rule}`]: 'error' }

  test('rejects an inline Tauri import in app code, and allows it only in the support gate files', async () => {
    const source =
      "export async function run() { const { invoke } = await import('@tauri-apps/api/core'); return invoke('x') }"
    const diagnostics = ruleDiagnostics(
      await lintFiles(
        {
          'src/app/document/save.ts': source,
          'src/app/shell/support/gate.ts': source,
          'src/app/shell/support/render.ts': source,
          'src/app/shell/support/detect.ts': source,
          'src/app/document/template.ts':
            'export const load = () => import(`@tauri-apps/api/core`)',
          'src/app/document/static.ts':
            "import { invoke } from '@tauri-apps/api/core'\nexport const run = () => invoke('x')",
          'src/app/document/lazy.ts': "export const load = () => import('./heavy')",
          'tests/helpers/tauri/mocks.ts': source
        },
        rules
      ),
      rule
    )
    expect(diagnostics.map((diagnostic) => diagnostic.filename).sort()).toEqual([
      expect.stringMatching(/src\/app\/document\/save\.ts$/),
      expect.stringMatching(/src\/app\/document\/template\.ts$/),
      expect.stringMatching(/src\/app\/shell\/support\/detect\.ts$/)
    ])
  })
})

describe('import boundary rules', () => {
  test('see inline imports as well as static ones', async () => {
    const rule = 'no-core-framework-imports'
    const diagnostics = ruleDiagnostics(
      await lintFiles(
        {
          'packages/core/src/io/export.ts':
            "export const load = () => import('@tauri-apps/api/core')"
        },
        { [`open-pencil/${rule}`]: 'error' }
      ),
      rule
    )
    expect(diagnostics).toHaveLength(1)
  })
})
