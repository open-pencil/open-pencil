import { describe, expect, test } from 'bun:test'

import { nodeChangeToProps, sceneNodeToKiwi } from '#fig/node-change/index'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

// Figma desktop, 2026-10-10: a copied polygon or star carries its point count and a star its inner
// scale, and no geometry; Figma draws it from those fields.

describe('polygon and star records', () => {
  test('write their point count and inner scale', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const star = graph.createNode('STAR', page.id, { pointCount: 6, starInnerRadius: 0.5 })
    const polygon = graph.createNode('POLYGON', page.id, { pointCount: 5 })
    const write = (id: string) => {
      const node = graph.getNode(id)
      if (!node) throw new Error('Expected the node')
      return sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])[0]
    }
    expect(write(star.id)).toMatchObject({ type: 'STAR', count: 6, starInnerScale: 0.5 })
    const written = write(polygon.id)
    expect(written).toMatchObject({ type: 'REGULAR_POLYGON', count: 5 })
    expect(written.starInnerScale).toBeUndefined()
  })

  test('read the point count and inner scale Figma copies', () => {
    const star = nodeChangeToProps(
      { type: 'STAR', size: { x: 207, y: 168 }, count: 6, starInnerScale: 0.5 } as NodeChange,
      []
    )
    expect(star).toMatchObject({ nodeType: 'STAR', pointCount: 6, starInnerRadius: 0.5 })
    const polygon = nodeChangeToProps(
      { type: 'REGULAR_POLYGON', size: { x: 100, y: 100 }, count: 3 } as NodeChange,
      []
    )
    expect(polygon).toMatchObject({ nodeType: 'POLYGON', pointCount: 3 })
  })

  // Figma's plugin API clamps a point count to 3–60 and rejects an inner ratio outside 0–1; the
  // wire format allows far more, which would otherwise size the outline.
  test('hold an imported count and inner scale to Figma ranges', () => {
    const read = (change: Partial<NodeChange>) =>
      nodeChangeToProps({ type: 'STAR', size: { x: 100, y: 100 }, ...change } as NodeChange, [])
    expect(read({ count: 4_000_000_000, starInnerScale: 1.5 })).toMatchObject({
      pointCount: 60,
      starInnerRadius: 1
    })
    expect(read({ count: 1, starInnerScale: -0.5 })).toMatchObject({
      pointCount: 3,
      starInnerRadius: 0
    })
    expect(read({ starInnerScale: Number.NaN }).starInnerRadius).toBeUndefined()
  })

  // Figma desktop, 2026-10-10: a paste with a GUID part of 2³¹ or more is dropped whole. Layers
  // made in a session past that keep its IDs as their source through autosave.
  test('do not carry an ID Figma cannot read as their GUID', () => {
    const graph = new SceneGraph()
    const star = graph.createNode('STAR', graph.getPages()[0].id)
    graph.updateNode(star.id, { source: { ...star.source, id: '2496617298:3' } })
    const node = graph.getNode(star.id)
    if (!node) throw new Error('Expected the star')
    const [record] = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    expect(record.guid).toEqual({ sessionID: 1, localID: 2 })
  })
})
