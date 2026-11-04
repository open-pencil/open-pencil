import { describe, expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '@open-pencil/fig/node-change'
import { SceneGraph } from '@open-pencil/scene-graph'

function serializeCornerSmoothing(value: number, importedValue?: number) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const node = graph.createNode('RECTANGLE', page.id, { cornerRadius: 24, cornerSmoothing: value })
  if (importedValue !== undefined) {
    graph.updateNode(node.id, {
      source: {
        ...node.source,
        id: '1:2',
        fig: {
          ...node.source.fig,
          rawNodeFields: {
            ...node.source.fig.rawNodeFields,
            cornerSmoothing: importedValue
          }
        }
      }
    })
  }
  const current = graph.getNode(node.id)
  if (!current) throw new Error('Expected rectangle node')
  return sceneNodeToKiwi(current, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])[0]
    .cornerSmoothing
}

describe('Figma corner smoothing export', () => {
  test('exports normalized smoothing values', () => {
    expect(serializeCornerSmoothing(0.72)).toBe(0.72)
  })

  test('overrides stale imported smoothing when edited back to zero', () => {
    expect(serializeCornerSmoothing(0, 0.72)).toBe(0)
  })
})
