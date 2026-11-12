import { describe, expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '#fig/node-change/index'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import type { GUID } from '@open-pencil/scene-graph/primitives'

interface Override {
  guidPath?: { guids?: GUID[] }
  name?: string
  size?: unknown
}

/** The overrides an instance of a component without layers carries: the one at its own path. */
function ownOverrides(graph: SceneGraph, instance: SceneNode): Override[] {
  const [change] = sceneNodeToKiwi(
    instance,
    { sessionID: 1, localID: 0 },
    0,
    { value: 100 },
    graph,
    []
  )
  const symbolData = change.symbolData as { symbolOverrides?: Override[] } | undefined
  return symbolData?.symbolOverrides ?? []
}

describe("an instance's own name", () => {
  // Figma shows the name of the override at the instance's own path and ignores the record's.
  test('is written at its own path when it differs from its component’s', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', pageId, { name: 'Component' })
    // The component's record GUID, which is the instance's own path.
    component.source.id = '7:7'
    const plain = graph.createInstance(component.id, pageId)
    const renamed = graph.createInstance(component.id, pageId, { name: 'Lazy instance' })
    if (!plain || !renamed) throw new Error('Missing instances')

    expect(ownOverrides(graph, plain)).toEqual([])
    expect(ownOverrides(graph, renamed)).toEqual([
      { guidPath: { guids: [{ sessionID: 7, localID: 7 }] }, name: 'Lazy instance' }
    ])
  })

  // Without a name of its own, Figma names a variant's instance after the variant set.
  test('of a variant is compared with its set’s name', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const set = graph.createNode('COMPONENT_SET', pageId, { name: 'Button' })
    const variant = graph.createNode('COMPONENT', set.id, { name: 'Size=Small' })
    const named = graph.createInstance(variant.id, pageId)
    const setNamed = graph.createInstance(variant.id, pageId, { name: 'Button' })
    if (!named || !setNamed) throw new Error('Missing instances')

    expect(ownOverrides(graph, named).map((override) => override.name)).toEqual(['Size=Small'])
    expect(ownOverrides(graph, setNamed)).toEqual([])
  })

  test('replaces the one a file gave it, keeping the rest of that override', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', pageId, { name: 'Component' })
    component.source.id = '7:7'
    const retained = { guidPath: { guids: [{ sessionID: 7, localID: 7 }] }, name: 'From Figma' }
    const renamed = graph.createInstance(component.id, pageId, { name: 'Renamed' })
    // Renamed back to its component's name, which Figma would show without the override too.
    const restored = graph.createInstance(component.id, pageId)
    if (!renamed || !restored) throw new Error('Missing instances')
    renamed.source.fig.symbolOverrides = [{ ...retained, size: { x: 10, y: 10 } }]
    restored.source.fig.symbolOverrides = [retained]

    expect(ownOverrides(graph, renamed)).toEqual([
      { guidPath: retained.guidPath, size: { x: 10, y: 10 }, name: 'Renamed' }
    ])
    expect(ownOverrides(graph, restored)).toEqual([
      { guidPath: retained.guidPath, name: 'Component' }
    ])
  })
})
