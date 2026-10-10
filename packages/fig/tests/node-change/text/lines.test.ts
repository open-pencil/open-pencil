import { describe, expect, test } from 'bun:test'

import { importParagraphStyles } from '#fig/node-change/text/lines'

describe('importParagraphStyles', () => {
  test('nests a list line with no stored level at the first level', () => {
    expect(
      importParagraphStyles([
        { lineType: 'UNORDERED_LIST' },
        { lineType: 'ORDERED_LIST', indentationLevel: 9 },
        { lineType: 'PLAIN', indentationLevel: 2 }
      ])
    ).toEqual([
      { listType: 'UNORDERED', indentation: 1 },
      { listType: 'ORDERED', indentation: 5 },
      { listType: 'NONE', indentation: 2 }
    ])
  })
})
