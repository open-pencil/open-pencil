import { describe, expect, test } from 'bun:test'

import { computeAllLayouts } from '#core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

// Nuxt UI's separators, as Figma saved them in the Nuxt UI kit: a Fill line in a 20 px row stays a
// line, centred, and a vector with no width keeps none.
function row(child: 'LINE' | 'VECTOR') {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id, {
    width: 104,
    height: 20,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    counterAxisAlign: 'CENTER',
    primaryAxisAlign: 'CENTER'
  })
  const node = graph.createNode(child, frame.id, {
    width: child === 'LINE' ? 50 : 0,
    height: child === 'LINE' ? 0 : 20,
    layoutGrow: 1,
    layoutAlignSelf: 'STRETCH'
  })
  computeAllLayouts(graph, page.id)
  return node
}

describe('a line or vector with no extent on an axis', () => {
  test('a Fill line fills along the row and stays a line across it', () => {
    const line = row('LINE')
    expect([line.x, line.y, line.width, line.height]).toEqual([0, 10, 104, 0])
  })

  test('a vector with no width keeps none along the row', () => {
    const vector = row('VECTOR')
    expect([vector.x, vector.width, vector.height]).toEqual([52, 0, 20])
  })
})
