import { describe, expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'
import { SceneGraph } from '#core/scene-graph'

describe('Figma mask export', () => {
  test('exports schema mask fields', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const mask = graph.createNode('RECTANGLE', page.id, {
      isMask: true,
      maskType: 'LUMINANCE',
      maskIsOutline: true
    })

    const changes = sceneNodeToKiwi(mask, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])

    expect(changes[0].mask).toBe(true)
    expect(changes[0].maskType).toBe('LUMINANCE')
    expect(changes[0].maskIsOutline).toBe(true)
  })
})
