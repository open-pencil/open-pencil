import type { Page } from '@playwright/test'

import type { Color } from '@open-pencil/scene-graph/primitives'

/** Layers to sample from and paint into, and the paints the eyedropper leaves on them. */
export function eyedropperDriver(page: () => Page) {
  return {
    /** The first selected layer's id, if any. */
    selectedId() {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        return [...store.state.selectedIds][0] ?? null
      })
    },

    /** The layer's top paint of the kind, which the eyedropper replaces. */
    topPaint(id: string, kind: 'fills' | 'strokes') {
      return page().evaluate(
        ([nodeId, key]) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          const paint = store.graph.getNode(nodeId)?.[key].at(-1)
          return paint?.type === 'SOLID' ? { color: paint.color } : null
        },
        [id, kind] as const
      )
    },

    /** Setup: gives the layer one opaque solid fill. */
    setFill(id: string, color: Color) {
      return page().evaluate(
        ([nodeId, value]) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          store.updateNodeWithUndo(nodeId, {
            fills: [{ type: 'SOLID', color: value, opacity: 1, visible: true }]
          })
        },
        [id, color] as const
      )
    },

    /** The tool the editor has armed. */
    activeTool() {
      return page().evaluate(() => window.openPencil?.getStore?.().state.activeTool ?? null)
    }
  }
}
