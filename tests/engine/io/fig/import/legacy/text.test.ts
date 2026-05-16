import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { canvas, doc, node } from './helpers'

describe('fig-import: text properties', () => {
  test('text auto resize', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('TEXT', 10, 1, {
        textData: { characters: 'Hello' },
        fontSize: 16,
        textAlignHorizontal: 'CENTER',
        textAutoResize: 'WIDTH_AND_HEIGHT'
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(n.textAlignHorizontal).toBe('CENTER')
  })

  test('font weight mapping', () => {
    const cases = [
      ['Bold', 700],
      ['Semi Bold', 600],
      ['Light', 300],
      ['ExtraBold', 800],
      ['Black', 900],
      ['Thin', 100],
      ['Medium', 500],
      ['Regular', 400]
    ] as const

    for (const [style, expected] of cases) {
      const graph = importNodeChanges([
        doc(),
        canvas(),
        node('TEXT', 10, 1, {
          textData: { characters: 'X' },
          fontName: { family: 'Inter', style }
        } as Partial<NodeChange>)
      ])
      const n = graph.getChildren(graph.getPages()[0].id)[0]
      expect(n.fontWeight).toBe(expected)
    }
  })
})
