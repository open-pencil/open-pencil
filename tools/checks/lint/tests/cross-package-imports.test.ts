import { expect, test } from 'bun:test'

import { lintFiles, ruleDiagnostics } from './helpers/lint.ts'

test("no-cross-package-source rejects subpaths a workspace package's exports do not declare", async () => {
  const rule = '@open-pencil/imports/no-cross-package-source'
  const cases = {
    'internal.ts': ["import { a } from '@open-pencil/core/canvas/overlays'", 1],
    'internal-export.ts': ["export { a } from '@open-pencil/core/editor'", 1],
    'internal-inline.ts': ["await import('@open-pencil/core/tools/read')", 1],
    'source-tree.ts': ["import { a } from '../../packages/core/src/editor'", 1],
    'exported.ts': ["import { a } from '@open-pencil/core/vector'", 0],
    'package-root.ts': ["import { a } from '@open-pencil/core'", 0],
    'pattern.ts': ["import font from '@open-pencil/core/assets/Inter.ttf'", 0],
    'package-alias.ts': ["import { a } from '#core/editor'", 0],
    'third-party.ts': ["import { a } from 'es-toolkit/array'", 0]
  } as const
  const diagnostics = ruleDiagnostics(
    await lintFiles(
      Object.fromEntries(Object.entries(cases).map(([path, [source]]) => [path, source])),
      { [rule]: 'error' }
    ),
    rule
  )
  for (const [path, [, count]] of Object.entries(cases)) {
    const found = diagnostics.filter((diagnostic) => diagnostic.filename?.endsWith(path))
    expect(found, path).toHaveLength(count)
  }
})
