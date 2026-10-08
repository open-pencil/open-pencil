import { describe, expect, test } from 'bun:test'

import { iconNames, SceneGraph, withIcon } from '@open-pencil/scene-graph'

function icon(graph: SceneGraph, parentId: string, name: string) {
  const frame = graph.createNode('FRAME', parentId, { name: `Icon / ${name}` })
  graph.updateNode(frame.id, { pluginData: withIcon(frame, { name }) })
  return frame
}

describe('iconNames', () => {
  test('lists each placed icon once, in the order met, across frames', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const card = graph.createNode('FRAME', pageId, { name: 'Card' })
    icon(graph, pageId, 'lucide:heart')
    icon(graph, card.id, 'mdi:home')
    icon(graph, card.id, 'lucide:heart')
    graph.createNode('RECTANGLE', pageId, { name: 'Icon / lucide:star' })

    expect(iconNames(graph.getAllNodes())).toEqual(['lucide:heart', 'mdi:home'])
  })
})
