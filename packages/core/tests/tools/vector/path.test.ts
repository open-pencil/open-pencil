import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

const pathSet = ALL_TOOLS.find((tool) => tool.name === 'path_set')
if (!pathSet) throw new Error('path_set tool missing')

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const node = graph.createNode('VECTOR', graph.getPages()[0].id, { name: 'Path' })
  return { graph, figma, id: node.id }
}

describe('path_set', () => {
  test('writes a normalized vector network', () => {
    const { graph, figma, id } = setup()
    const path = JSON.stringify({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      segments: [{ start: 0, end: 1 }]
    })
    expect(pathSet.execute(figma, { id, path })).toEqual({ id })
    expect(graph.getNode(id)?.vectorNetwork).toEqual({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    })
  })

  test.each([
    ['malformed JSON', '{"vertices": [', 'Invalid VectorNetwork JSON'],
    ['a non-object', '42', 'Invalid VectorNetwork: network must be an object'],
    [
      'an out-of-range segment',
      JSON.stringify({ vertices: [{ x: 0, y: 0 }], segments: [{ start: 0, end: 4 }] }),
      'Invalid VectorNetwork: segment[0]: end index 4 out of range'
    ],
    [
      'a malformed tangent',
      JSON.stringify({
        vertices: [
          { x: 0, y: 0 },
          { x: 1, y: 1 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 'a', y: 0 } }]
      }),
      'Invalid VectorNetwork: segment[0]: tangentStart must contain finite x and y numbers'
    ]
  ])('rejects %s without touching the node', (_label, path, error) => {
    const { graph, figma, id } = setup()
    const before = graph.getNode(id)?.vectorNetwork
    expect(pathSet.execute(figma, { id, path })).toEqual({ error })
    expect(graph.getNode(id)?.vectorNetwork).toEqual(before)
  })
})
