import { describe, expect, test } from 'bun:test'

import { computeAllLayouts, SceneGraph } from '@open-pencil/core'

// Reduced from BIZUP's classification label rows: a 10px marker and a
// fixed-size 16px text box that fills both axes in a cross-axis HUG row.
describe('fixed text intrinsic cross-axis size', () => {
  for (const layoutMode of ['HORIZONTAL', 'VERTICAL'] as const) {
    test(`${layoutMode} HUG includes a stretched fixed text box`, () => {
      const graph = new SceneGraph()
      const row = layoutMode === 'HORIZONTAL'
      const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
        layoutMode,
        width: row ? 332 : 16,
        height: row ? 16 : 332,
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'HUG',
        counterAxisAlign: 'CENTER',
        itemSpacing: 8
      })
      const marker = graph.createNode('RECTANGLE', frame.id, { width: 10, height: 10 })
      const text = graph.createNode('TEXT', frame.id, {
        text: 'Classificação Silver',
        width: row ? 314 : 16,
        height: row ? 16 : 314,
        textAutoResize: 'NONE',
        layoutGrow: 1,
        layoutAlignSelf: 'STRETCH'
      })

      computeAllLayouts(graph)
      computeAllLayouts(graph)

      expect(row ? frame.height : frame.width).toBe(16)
      expect(row ? text.height : text.width).toBe(16)
      expect(row ? text.width : text.height).toBe(314)
      expect(row ? marker.y : marker.x).toBe(3)

      // A definite parent cross size still controls stretch, not the old box.
      graph.updateNode(frame.id, {
        counterAxisSizing: 'FIXED',
        ...(row ? { height: 12 } : { width: 12 })
      })
      computeAllLayouts(graph)
      expect(row ? text.height : text.width).toBe(12)
    })
  }
})
