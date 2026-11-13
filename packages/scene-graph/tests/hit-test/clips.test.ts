import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { clipsChildren } from '@open-pencil/scene-graph/node-defaults'
import { SOLID_FILL } from '@open-pencil/test-support/scene'

// Figma desktop (2026-11-14): frames, components, component sets and instances clip with clip
// content on; a section or group has no such setting, and a section's export grows by a child
// past its edge.
describe('which layers clip their children', () => {
  test('a frame, component, component set and instance clip; a section and group never do', () => {
    const clipping = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'] as const
    for (const type of clipping) expect(clipsChildren({ type, clipsContent: true })).toBe(true)
    for (const type of clipping) expect(clipsChildren({ type, clipsContent: false })).toBe(false)
    for (const type of ['SECTION', 'GROUP', 'RECTANGLE'] as const) {
      expect(clipsChildren({ type, clipsContent: true })).toBe(false)
    }
  })

  test('a section an import marked as clipping still finds a layer past its edge', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const section = graph.createNode('SECTION', page, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      clipsContent: true
    })
    const past = graph.createNode('RECTANGLE', section.id, {
      fills: [SOLID_FILL],
      x: 50,
      y: 10,
      width: 100,
      height: 50
    })
    expect(graph.hitTestDeep(125, 30)?.id).toBe(past.id)
  })
})
