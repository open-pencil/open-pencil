import { expect, test } from 'bun:test'

import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'

import { BLACK_STROKE, paths, rects, solid } from './helpers'

const RED: Fill = solid(1, 0, 0, 1, 1)
const BLUE: Fill = solid(0, 0, 1, 1, 1)

async function exported(operation: 'SUBTRACT' | 'INTERSECT', align: 'INSIDE' | null = null) {
  const graph = new SceneGraph()
  const boolean = graph.createNode('BOOLEAN_OPERATION', graph.getPages()[0].id, {
    width: 40,
    height: 40,
    booleanOperation: operation,
    fills: [RED],
    strokes: align ? [{ ...BLACK_STROKE, align }] : []
  })
  graph.createNode('RECTANGLE', boolean.id, { width: 40, height: 40, fills: [BLUE] })
  graph.createNode('RECTANGLE', boolean.id, {
    x: operation === 'INTERSECT' ? 100 : 10,
    y: 10,
    width: 20,
    height: 20,
    fills: [BLUE]
  })
  const { data } = await new IORegistry(BUILTIN_IO_FORMATS).exportContent('svg', {
    graph,
    target: { scope: 'node', nodeId: boolean.id }
  })
  if (typeof data !== 'string') throw new Error('Expected SVG markup')
  return data
}

test('a boolean operation exports its result with its own paint, not its operands', async () => {
  const svg = await exported('SUBTRACT')
  expect(rects(svg)).toEqual([])
  expect(paths(svg)).toHaveLength(1)
  expect(svg).not.toContain('#0000FF')
})

test('an empty boolean operation draws nothing', async () => {
  await expect(exported('INTERSECT')).rejects.toThrow('Nothing to export')
})

test("a boolean operation's inside stroke is clipped to its result", async () => {
  const svg = await exported('SUBTRACT', 'INSIDE')
  expect(svg).toMatch(/<clipPath[^>]*>\s*<path [^>]*clip-rule="evenodd"/)
  expect(svg).toContain('stroke-width="4"')
})
