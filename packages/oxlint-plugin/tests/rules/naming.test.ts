import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from '#oxlint-plugin-tests/helpers/lint'

const rule = '@open-pencil/structure/no-mixed-case-acronym-identifiers'

async function count(source: string, options?: Record<string, unknown>): Promise<number> {
  const config = options ? ['error', options] : 'error'
  return ruleDiagnostics(await lint(source, { [rule]: config }), rule).length
}

describe(rule, () => {
  test.each([
    'export const baseUrl = 1',
    'export function parseJson() {}',
    'export const htmlUrl = 1',
    'export class ApiClient {}'
  ])('rejects %s', async (source) => {
    expect(await count(source)).toBe(1)
  })

  test.each([
    'export const baseURL = 1',
    'export const builder = 1',
    'export const aiModel = 1',
    'export const options = { baseUrl: 1 }',
    'export const value = request.baseUrl',
    "import Url from 'vendor'\nexport {}"
  ])('accepts %s', async (source) => {
    expect(await count(source)).toBe(0)
  })

  test("ignoredImports accepts a package's names where they are imported", async () => {
    const source = "import { openUrl as openLink } from 'vendor'\nopenLink()"
    expect(await count(source)).toBe(1)
    expect(await count(source, { ignoredImports: ['vendor'] })).toBe(0)
  })

  test('ignoredImports leaves the local binding to ignoredIdentifiers', async () => {
    const source = "import { openUrl } from 'vendor'\nopenUrl()"
    expect(await count(source, { ignoredImports: ['vendor'] })).toBe(2)
    expect(
      await count(source, { ignoredImports: ['vendor'], ignoredIdentifiers: ['openUrl'] })
    ).toBe(0)
  })

  test('ignoredIdentifiers accepts upstream names everywhere', async () => {
    const source = 'export const useObjectUrl = 1'
    expect(await count(source, { ignoredIdentifiers: ['useObjectUrl'] })).toBe(0)
  })
})
