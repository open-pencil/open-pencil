import { describe, expect, test } from 'bun:test'

import { lint, lintFiles, ruleDiagnostics } from '#oxlint-plugin-tests/helpers/lint'

describe('@open-pencil/structure/no-sibling-domain-prefixed-files', () => {
  const rule = '@open-pencil/structure/no-sibling-domain-prefixed-files'

  test('reports a prefix that names a sibling folder, not a suffix that does', async () => {
    const found = ruleDiagnostics(
      await lintFiles(
        {
          'list/index.ts': 'export {}',
          'page-list.ts': 'export {}',
          'list-actions.ts': 'export {}',
          'list-actions.test.ts': 'export {}'
        },
        { [rule]: 'error' }
      ),
      rule
    )
    expect(
      found
        .map((diagnostic) => diagnostic.filename?.split('/').at(-1) ?? '')
        .toSorted((left, right) => left.localeCompare(right))
    ).toEqual(['list-actions.test.ts', 'list-actions.ts'])
  })
})

describe('@open-pencil/structure/no-useless-pass-through-wrappers', () => {
  const rule = '@open-pencil/structure/no-useless-pass-through-wrappers'
  const count = async (source: string) =>
    ruleDiagnostics(await lint(source, { [rule]: 'error' }), rule).length

  test.each([
    'function save(document) { return write(document) }',
    'const save = (document, options) => write(document, options)',
    'const save = function (document) { return write(document) }'
  ])('rejects %s', async (source) => {
    expect(await count(source)).toBe(1)
  })

  test.each([
    'function save(document) { return write(document, true) }',
    'function save(document) { log(document); return write(document) }',
    'const save = ({ id }) => write(id)',
    'function save(document) { return save(document) }'
  ])('accepts %s', async (source) => {
    expect(await count(source)).toBe(0)
  })
})
