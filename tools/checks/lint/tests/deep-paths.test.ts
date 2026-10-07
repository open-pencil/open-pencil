import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'no-deep-parent-relative-paths'
const rules = { [`open-pencil/${rule}`]: 'error' }
// A template that climbs one level and then names a folder, assembled so it stays source text.
const oneLevelTemplate = ['join(import.meta.dir, `../', '$', "{folder}`, '..', 'assets')"].join('')

describe('no-deep-parent-relative-paths', () => {
  test.each([
    "new URL('../../fixtures/a.fig', import.meta.url)",
    'new URL(`../../fixtures/a.fig`, import.meta.url)',
    "resolve(import.meta.dir, '../../../tests/fixtures')",
    "join(import.meta.dirname, '..', '..', 'assets')",
    "path.resolve(import.meta.dir, '../..')",
    "join(import.meta.dir, '..\\\\..\\\\assets')",
    "join(dirname(fileURLToPath(import.meta.url)), '../../fixtures')"
  ])('rejects %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(1)
  })

  test.each([
    "new URL('../fixtures/a.fig', import.meta.url)",
    "new URL('./worker.ts', import.meta.url)",
    "join(import.meta.dir, '..', 'fixtures')",
    "credentialRef('../../other-app', 'api-key')",
    "resolve(root, '../../somewhere')",
    "join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')",
    oneLevelTemplate
  ])('accepts %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(0)
  })
})
