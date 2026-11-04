import type { Page } from '@playwright/test'

import type { Vector } from '@open-pencil/scene-graph/primitives'

/** A frame to add: its size and layout, and the rectangles inside it. */
interface FrameSetup {
  name: string
  layoutMode?: 'HORIZONTAL' | 'VERTICAL'
  width: number
  height: number
  children: { name: string; x?: number; y?: number; width?: number; height?: number }[]
}

/** Probes and drivers for layers on the current page. */
export function layerDriver(page: () => Page) {
  /** Adds a frame with rectangles inside to the current page; returns their ids. */
  function addFrame(setup: FrameSetup): Promise<{ frame: string; children: string[] }> {
    return page().evaluate(({ children, ...frameProps }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const frame = store.graph.createNode('FRAME', store.state.currentPageId, frameProps)
      const ids = children.map((child) => store.graph.createNode('RECTANGLE', frame.id, child).id)
      store.requestRender()
      return { frame: frame.id, children: ids }
    }, setup)
  }

  return {
    /** Where the centre of the named layer shows on the canvas, in canvas-element pixels. */
    screenCenter(name: string): Promise<Vector> {
      return page().evaluate((layerName) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const layer = store.graph
          .getChildren(store.state.currentPageId)
          .find((node) => node.name === layerName)
        if (!layer) throw new Error(`No layer named ${layerName}`)
        const { zoom, panX, panY } = store.state
        return {
          x: (layer.x + layer.width / 2) * zoom + panX,
          y: (layer.y + layer.height / 2) * zoom + panY
        }
      }, name)
    },

    /**
     * Driver: an auto layout frame on the current page with a rectangle per name in its flow,
     * expanded in the layers panel by selecting its first item.
     */
    async autoLayoutWithItems(
      name: string,
      layoutMode: 'HORIZONTAL' | 'VERTICAL',
      itemNames: readonly string[]
    ): Promise<{ frame: string; items: string[] }> {
      const { frame, children: items } = await addFrame({
        name,
        layoutMode,
        width: 400,
        height: 120,
        children: itemNames.map((itemName) => ({ name: itemName, width: 80, height: 80 }))
      })
      await page().evaluate((first) => window.openPencil?.getStore?.().select([first]), items[0])
      return { frame, items }
    },

    /** Driver: a frame on the current page with `count` rectangles named `Child 1` and on. */
    frameWithChildren(name: string, count: number): Promise<{ frame: string; children: string[] }> {
      return addFrame({
        name,
        width: 400,
        height: 400,
        children: Array.from({ length: count }, (_, i) => ({ name: `Child ${i + 1}`, x: i, y: i }))
      })
    },

    /** Driver: selects layers by id, as a click on the canvas does, revealing them in the panel. */
    select(ids: readonly string[]): Promise<void> {
      return page().evaluate((layerIds) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.select([...layerIds])
      }, ids)
    },

    /** Driver: clears the selection, so a screenshot shows no handles. */
    clearSelection(): Promise<void> {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.clearSelection()
      })
    }
  }
}
