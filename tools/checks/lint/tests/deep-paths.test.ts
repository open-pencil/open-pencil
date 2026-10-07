import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'no-deep-parent-relative-paths'
const rules = { [`open-pencil/${rule}`]: 'error' }

describe('no-deep-parent-relative-paths', () => {
  test.each([
    "new URL('../../fixtures/a.fig', import.meta.url)",
    'new URL(`../../fixtures/a.fig`, import.meta.url)',
    "resolve(import.meta.dir, '../../../tests/fixtures')",
    "join(import.meta.dirname, '..', '..', 'assets')",
    "path.resolve(import.meta.dir, '../..')"
  ])('rejects %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(1)
  })

  test.each([
    "new URL('../fixtures/a.fig', import.meta.url)",
    "new URL('./worker.ts', import.meta.url)",
    "join(import.meta.dir, '..', 'fixtures')",
    "credentialRef('../../other-app', 'api-key')",
    "resolve(root, '../../somewhere')"
  ])('accepts %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(0)
  })
})
