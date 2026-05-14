import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'bun:test'

import { openPencilArchitecturePlugin } from '@/../scripts/steiger-rules'

type TreeEntry = {
  type: 'file' | 'folder'
  path: string
  children?: TreeEntry[]
}

function treeFromFiles(root: string, files: string[]): TreeEntry {
  return {
    type: 'folder',
    path: root,
    children: files.map((file) => ({ type: 'file', path: path.join(root, file) }))
  }
}

function withFixture(files: Record<string, string>, run: (root: TreeEntry) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), 'open-pencil-arch-'))
  try {
    for (const [file, content] of Object.entries(files)) {
      const fullPath = path.join(dir, file)
      mkdirSync(path.dirname(fullPath), { recursive: true })
      writeFileSync(fullPath, content)
    }
    run(treeFromFiles(dir, Object.keys(files)))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function ruleNamesFor(files: Record<string, string>) {
  let names: string[] = []
  withFixture(files, (root) => {
    names = openPencilArchitecturePlugin.ruleDefinitions.flatMap((rule) =>
      rule.check(root).diagnostics.map(() => rule.name)
    )
  })
  return names
}

describe('OpenPencil architecture rules', () => {
  test('enforces test file placement and naming', () => {
    expect(ruleNamesFor({ 'tests/e2e/bad.test.ts': '' })).toContain(
      'open-pencil/strict-test-file-placement'
    )
    expect(ruleNamesFor({ 'tests/engine/bad.spec.ts': '' })).toContain(
      'open-pencil/strict-test-file-placement'
    )
    expect(ruleNamesFor({ 'tests/helpers/setup.ts': '' })).not.toContain(
      'open-pencil/strict-test-file-placement'
    )
  })

  test('blocks engine-only assertions in E2E tests', () => {
    const names = ruleNamesFor({
      'tests/e2e/editor/example.spec.ts':
        "import { expect } from 'bun:test'\nimport { helper } from '../../engine/helper'\n"
    })

    expect(names).toContain('open-pencil/no-engine-only-assertions-in-e2e')
  })

  test('blocks E2E imports from engine tests', () => {
    const names = ruleNamesFor({
      'tests/engine/editor/example.test.ts': "import { fixture } from '../../e2e/editor/example.spec'\n"
    })

    expect(names).toContain('open-pencil/no-e2e-imports-in-engine-tests')
  })

  test('blocks app code from importing app component layers', () => {
    const names = ruleNamesFor({
      'src/app/editor/service.ts': "import EditorCanvas from '@/components/EditorCanvas.vue'\n"
    })

    expect(names).toContain('open-pencil/no-app-imports-components-or-views')
  })

  test('blocks shared UI from importing app services', () => {
    const names = ruleNamesFor({
      'src/components/ui/toast.ts': "import { toast } from '@/app/shell/ui'\n"
    })

    expect(names).toContain('open-pencil/no-app-imports-in-shared-ui')
  })

  test('blocks canvas overlays from importing property-panel internals', () => {
    const names = ruleNamesFor({
      'src/components/EditorCanvas.vue': "import PaddingControls from '@/components/properties/LayoutSection/PaddingControls.vue'\n"
    })

    expect(names).toContain('open-pencil/no-property-panel-imports-in-canvas')
    expect(names).toContain('open-pencil/no-property-panel-internals-outside-panel')
  })

  test('blocks package-local aliases outside their owning package', () => {
    const names = ruleNamesFor({
      'packages/vue/src/canvas/use.ts': "import { SceneGraph } from '#core/scene-graph'\n"
    })

    expect(names).toContain('open-pencil/no-foreign-package-local-aliases')
  })

  test('allows app code to import public workspace package exports and shared UI', () => {
    const names = ruleNamesFor({
      'src/app/editor/service.ts':
        "import { useCanvas } from '@open-pencil/vue'\nimport type { ToastVariant } from '@/components/ui/toast'\n"
    })

    expect(names).not.toContain('open-pencil/no-package-internals-in-app')
    expect(names).not.toContain('open-pencil/no-app-imports-components-or-views')
  })
})
