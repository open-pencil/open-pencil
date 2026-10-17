import { describe, expect, test } from 'bun:test'

import { parsePenFile, type PenNode } from '@open-pencil/pen'
import { colorToHex } from '@open-pencil/scene-graph/color'

function at<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value')
  return value
}

function pen(children: PenNode[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ version: '2.8', children, ...extra })
}

function parse(json: string) {
  return parsePenFile(json)
}

function byName(json: string, name: string) {
  const graph = parse(json)
  // A page takes the name of the document's first child, so it can shadow the node under test.
  const nodes = [...graph.getAllNodes()].filter((node) => node.type !== 'CANVAS')
  return at(nodes.find((node) => node.name === name))
}

const RECT: PenNode = { type: 'rectangle', id: 'r1', name: 'Card', width: 50, height: 50 }

describe('a .pen stroke written the current way', () => {
  const current = (extra: Partial<PenNode>) => pen([{ ...RECT, ...extra }])

  test('reads the colour as the stroke and the weight from the sibling strokeWidth', () => {
    const rect = byName(current({ stroke: '#ff0000', strokeWidth: 2 }), 'Card')
    const [stroke] = rect.strokes

    expect(rect.strokes).toHaveLength(1)
    expect(colorToHex(at(stroke).color)).toBe('#FF0000')
    expect(at(stroke).weight).toBe(2)
    expect(at(stroke).type).toBe('SOLID')
  })

  test('defaults the weight to 1 when the document declares none', () => {
    const rect = byName(current({ stroke: '#00ff00' }), 'Card')

    expect(at(rect.strokes[0]).weight).toBe(1)
  })

  test('reads a per-side weight and keeps every side', () => {
    const rect = byName(current({ stroke: '#0000ff', strokeWidth: { top: 1, bottom: 4 } }), 'Card')

    expect(rect.independentStrokeWeights).toBe(true)
    expect(rect.borderTopWeight).toBe(1)
    expect(rect.borderBottomWeight).toBe(4)
    expect(rect.borderLeftWeight).toBe(0)
    expect(at(rect.strokes[0]).weight).toBe(4)
  })

  test('resolves a stroke colour that references a declared variable', () => {
    const json = pen([{ ...RECT, stroke: '$--line', strokeWidth: 1 } as PenNode], {
      variables: { '--line': { type: 'color', value: '#123456' } }
    })
    const rect = byName(json, 'Card')

    expect(colorToHex(at(rect.strokes[0]).color)).toBe('#123456')
  })

  test('maps the inner alignment this format uses', () => {
    const rect = byName(
      current({ stroke: '#ff0000', strokeWidth: 1, strokeAlignment: 'inner' }),
      'Card'
    )

    expect(at(rect.strokes[0]).align).toBe('INSIDE')
  })
})

describe('a .pen stroke written the nested way', () => {
  test('still reads an object stroke with its own fill and thickness', () => {
    const rect = byName(
      pen([
        {
          ...RECT,
          stroke: { align: 'inside', thickness: 3, fill: '#00ff00', join: 'round', cap: 'round' }
        }
      ]),
      'Card'
    )

    expect(colorToHex(at(rect.strokes[0]).color)).toBe('#00FF00')
    expect(at(rect.strokes[0]).weight).toBe(3)
    expect(at(rect.strokes[0]).align).toBe('INSIDE')
    expect(rect.strokeJoin).toBe('ROUND')
    expect(rect.strokeCap).toBe('ROUND')
  })

  test('takes the default line colour when it declares no fill colour', () => {
    const json = pen([{ ...RECT, stroke: { align: 'inside', thickness: 1 } }])
    const card = byName(json, 'Card')

    expect(card.strokes).toHaveLength(1)
    expect(at(card.strokes[0]).weight).toBe(1)
  })
})
