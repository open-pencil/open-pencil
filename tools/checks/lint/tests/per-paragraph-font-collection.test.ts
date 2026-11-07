import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'no-per-paragraph-font-collection'
const rules = { [`open-pencil/${rule}`]: 'error' }
const SOURCE = 'packages/core/src/canvas/text/paragraph/index.ts'

describe('no-per-paragraph-font-collection', () => {
  test('rejects a paragraph builder with a collection of its own', async () => {
    const source = 'const builder = ck.ParagraphBuilder.MakeFromFontProvider(style, provider)'
    expect(ruleDiagnostics(await lint(source, rules, SOURCE), rule)).toHaveLength(1)
  })

  test.each([
    ['the shared collection', 'const builder = makeParagraphBuilder(ck, style, provider)', SOURCE],
    [
      'a test comparing against it',
      'const fresh = ck.ParagraphBuilder.MakeFromFontProvider(style, provider)',
      'packages/core/tests/text/font/collection.test.ts'
    ]
  ])('accepts %s', async (_name, source, file) => {
    expect(ruleDiagnostics(await lint(source, rules, file), rule)).toHaveLength(0)
  })
})
