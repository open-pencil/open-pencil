import { describe, expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '#fig/node-change/index'

import { SceneGraph, type Effect } from '@open-pencil/scene-graph'

const shadow: Effect = {
  type: 'DROP_SHADOW',
  color: { r: 0, g: 0, b: 0, a: 0.25 },
  offset: { x: 0, y: 4 },
  radius: 4,
  spread: 0,
  visible: true,
  blendMode: 'NORMAL',
  showShadowBehindNode: true
}

/** A rectangle imported with a repeat ahead of its shadow, which the scene graph does not model. */
function importedWithRepeat() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const node = graph.createNode('RECTANGLE', page.id, { width: 40, height: 40 })
  graph.updateNode(node.id, {
    effects: [shadow],
    source: {
      ...node.source,
      id: '1:2',
      editedFields: [],
      fig: {
        ...node.source.fig,
        rawNodeFields: {
          effects: [
            { type: 'REPEAT', visible: true, radius: 0 },
            { type: 'DROP_SHADOW', visible: true, radius: 4, offset: { x: 0, y: 4 } }
          ]
        }
      }
    }
  })
  return { graph, id: node.id }
}

function exportedEffectTypes(graph: SceneGraph, id: string) {
  const node = graph.getNode(id)
  if (!node) throw new Error('Expected the rectangle')
  const [change] = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
  return change.effects?.map((effect) => ({ type: effect.type, radius: effect.radius }))
}

describe('exporting the effects of imported layers', () => {
  test('keep effects the scene graph does not model through an edit of the others', () => {
    const { graph, id } = importedWithRepeat()
    graph.updateNode(id, { effects: [{ ...shadow, radius: 12 }] })
    expect(exportedEffectTypes(graph, id)).toEqual([
      { type: 'REPEAT', radius: 0 },
      { type: 'DROP_SHADOW', radius: 12 }
    ])
  })

  test('keep them when every modeled effect is removed', () => {
    const { graph, id } = importedWithRepeat()
    graph.updateNode(id, { effects: [] })
    expect(exportedEffectTypes(graph, id)).toEqual([{ type: 'REPEAT', radius: 0 }])
  })
})
