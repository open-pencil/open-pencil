import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createIconFromPaths } from '#core/icons/render'
import type { IconData, IconPath } from '#core/icons/types'

import { expectDefined } from '#tests/helpers/assert'

const BLACK = { r: 0, g: 0, b: 0, a: 1 }

function iconPath(overrides: Partial<IconPath>): IconPath {
  return {
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    },
    fill: null,
    stroke: null,
    strokeWidth: 1,
    strokeCap: 'butt',
    strokeJoin: 'miter',
    ...overrides
  }
}

function renderIcon(paths: IconPath[]) {
  const graph = new SceneGraph()
  const page = graph.createNode('CANVAS', graph.rootId, { name: 'Page 1' })
  const icon: IconData = { prefix: 'test', name: 'test', width: 24, height: 24, paths }
  const frame = createIconFromPaths(graph, icon, 'Test', 24, BLACK, page.id)
  return frame.childIds.map((id) => expectDefined(graph.getNode(id), 'path node'))
}

describe('createIconFromPaths', () => {
  test('treats fill="none" as no fill', () => {
    // "none" is a non-empty string, so a truthiness check sent it to
    // parseColor(), which falls back to black on unparseable input — every
    // outline drawing came out as a solid black blob.
    const [node] = renderIcon([iconPath({ fill: 'none', stroke: '#021A3B', strokeWidth: 6 })])
    expect(node.fills).toEqual([])
    expect(node.strokes.length).toBe(1)
  })

  test('treats stroke="none" as no stroke', () => {
    const [node] = renderIcon([iconPath({ fill: '#FF0000', stroke: 'none' })])
    expect(node.strokes).toEqual([])
    expect(node.fills.length).toBe(1)
  })

  test('still paints a real fill colour', () => {
    const [node] = renderIcon([iconPath({ fill: '#FF0000' })])
    expect(node.fills.length).toBe(1)
    expect(node.fills[0].color.r).toBeCloseTo(1)
  })
})
