import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from '#oxlint-plugin-tests/helpers/lint'

const rule = 'no-deep-parent-relative-imports'

async function diagnostics(source: string, options?: Record<string, unknown>) {
  const config = options ? ['error', options] : 'error'
  return ruleDiagnostics(await lint(source, { [`open-pencil/${rule}`]: config }), rule)
}

describe(rule, () => {
  test.each([
    "import { point } from '../../geometry/point'",
    "export { point } from '../../geometry/point'",
    "export * from '../../../geometry'",
    "const point = await import('../../geometry/point')"
  ])('rejects %s', async (source) => {
    expect(await diagnostics(source)).toHaveLength(1)
  })

  test.each([
    "import { point } from '../geometry/point'",
    "import { point } from './point'",
    "import { point } from '#app/geometry/point'",
    "import manifest from '../../package.json'"
  ])('accepts %s', async (source) => {
    expect(await diagnostics(source)).toHaveLength(0)
  })

  test('minDepth: 1 rejects any parent import and names the alias', async () => {
    const found = await diagnostics("import { point } from '../geometry/point'", {
      minDepth: 1,
      alias: '#core/*'
    })
    expect(found.map((diagnostic) => diagnostic.message)).toEqual([
      'Use the #core/* alias instead of parent-relative imports.'
    ])
  })
})

describe('no-function-alias-imports', () => {
  const aliasRule = 'no-function-alias-imports'
  const count = async (source: string) =>
    ruleDiagnostics(await lint(source, { [`open-pencil/${aliasRule}`]: 'error' }), aliasRule).length

  test('rejects an import renamed to end in Fn', async () => {
    expect(await count("import { parse as parseFn } from './parse'")).toBe(1)
  })

  test('accepts other renames and plain imports', async () => {
    expect(await count("import { parse as parsePoint } from './parse'")).toBe(0)
    expect(await count("import { parseFn } from './parse'")).toBe(0)
  })
})
