import type { Page } from '@playwright/test'

/** A fixed-size text's box height and how far its lines reach below its top. */
export interface TextOverflowState {
  height: number
  linesHeight: number | null
}

/**
 * Fixed-size texts grown past their boxes: one on the page over a rectangle showing its box, and
 * one in a frame that clips its content. The font size goes through the editor, which measures
 * the lines, as the panel's does.
 */
export function textOverflowDriver(page: () => Page) {
  return {
    show(): Promise<TextOverflowState[]> {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const pageId = store.state.currentPageId
        const boxFill = [
          {
            type: 'SOLID' as const,
            color: { r: 0.86, g: 0.91, b: 0.98, a: 1 },
            opacity: 1,
            visible: true
          }
        ]
        const frame = store.graph.createNode('FRAME', pageId, {
          name: 'Clips its content',
          x: 300,
          y: 40,
          width: 160,
          height: 120,
          clipsContent: true,
          fills: boxFill
        })
        store.graph.createNode('RECTANGLE', pageId, {
          name: 'Box',
          x: 40,
          y: 40,
          width: 110,
          height: 40,
          fills: boxFill
        })
        const ids = [
          { parent: pageId, x: 40, y: 40 },
          { parent: frame.id, x: 20, y: 20 }
        ].map(({ parent, x, y }) => {
          const text = store.graph.createNode('TEXT', parent, {
            x,
            y,
            width: 110,
            height: 40,
            text: 'dssdds grows',
            fontSize: 14,
            textAutoResize: 'NONE'
          })
          store.updateNode(text.id, { fontSize: 48 })
          return text.id
        })
        store.clearSelection()
        store.requestRender()
        return ids.map((id) => {
          const node = store.graph.getNode(id)
          if (!node) throw new Error(`Missing text ${id}`)
          return { height: node.height, linesHeight: node.derivedTextHeight }
        })
      })
    }
  }
}
