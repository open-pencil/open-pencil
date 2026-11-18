import { expect, test } from 'bun:test'

import { importSource, normalizedFilename } from '#oxlint-plugin/support/context'

test('prefers and normalizes the physical filename', () => {
  const context = {
    filename: 'virtual.ts',
    physicalFilename: String.raw`C:\repo\src\physical.ts`
  }
  expect(normalizedFilename(context)).toBe('C:/repo/src/physical.ts')
})

test('reads a module path from a template without expressions only', () => {
  const quasi = { type: 'TemplateElement', value: { raw: './point', cooked: './point' } }
  const fixed = {
    type: 'ImportExpression',
    source: { type: 'TemplateLiteral', quasis: [quasi], expressions: [] }
  }
  expect(importSource(fixed as never)).toBe('./point')
})
