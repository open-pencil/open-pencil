import { describe, expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '@open-pencil/fig/node-change'
import { SceneGraph } from '@open-pencil/scene-graph'

function serializeMiterLimit(strokeMiterLimit: number, importedMiterLimit?: number) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const node = graph.createNode('VECTOR', page.id, { strokeMiterLimit })
  if (importedMiterLimit !== undefined) {
    graph.updateNode(node.id, {
      source: {
        ...node.source,
        id: '1:2',
        fig: {
          ...node.source.fig,
          rawNodeFields: { ...node.source.fig.rawNodeFields, miterLimit: importedMiterLimit }
        }
      }
    })
  }
  const current = graph.getNode(node.id)
  if (!current) throw new Error('Expected vector node')
  return sceneNodeToKiwi(current, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])[0]
    .miterLimit
}

function serializeImportedDefaultJoin() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const node = graph.createNode('VECTOR', page.id, { strokeJoin: 'MITER' })
  graph.updateNode(node.id, {
    source: {
      ...node.source,
      id: '1:2',
      fig: {
        ...node.source.fig,
        rawNodeFields: { ...node.source.fig.rawNodeFields, strokeJoin: 'BEVEL' }
      }
    }
  })
  const current = graph.getNode(node.id)
  if (!current) throw new Error('Expected vector node')
  return sceneNodeToKiwi(current, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])[0]
    .strokeJoin
}

describe('Figma stroke geometry export', () => {
  test('exports non-default miter limits', () => {
    expect(serializeMiterLimit(12)).toBe(12)
  })

  test('overrides stale imported raw values when edited back to the default', () => {
    expect(serializeMiterLimit(4, 9)).toBe(4)
    expect(serializeImportedDefaultJoin()).toBe('MITER')
  })
})
