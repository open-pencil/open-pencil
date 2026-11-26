import type { Page } from '@playwright/test'

import { showView } from './page-scene'

/** A deck in the open document: its slides by section, the view it shows, and its removal. */
export function deckDriver(page: () => Page) {
  return {
    /**
     * Makes the open document a deck whose sections hold `sections` slides each, as New slides
     * starts one and Shift+S adds to it, and returns the slides' IDs in the deck's order.
     */
    async open(sections: readonly number[]): Promise<string[]> {
      return page().evaluate((sections) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.setDocumentKind('slides')
        const ids: string[] = []
        for (const [index, count] of sections.entries()) {
          for (let slide = 0; slide < count; slide++) {
            const id = store.addSlide(ids.at(-1))
            if (!id) throw new Error('No slide added')
            if (index > 0 && slide === 0) store.moveSlides([id], { type: 'section', before: null })
            ids.push(id)
          }
        }
        store.select([])
        store.focusSlide(null)
        return ids
      }, sections)
    },

    /** Takes the deck away and makes the document a design again, for the tests after. */
    async close() {
      await page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) return
        store.focusSlide(null)
        for (const node of store.graph.getChildren(store.state.currentPageId)) {
          if (node.type === 'SLIDE_GRID') store.graph.deleteNode(node.id)
        }
        store.select([])
        store.setDocumentKind('design')
        store.undo.clear()
      })
    },

    /** Puts a slide on the stage, fitted, or with null shows the whole deck fitted. */
    async show(id: string | null) {
      await page().evaluate((id) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.focusSlide(id)
        store.zoomToFit()
        store.requestRender()
      }, id)
    },

    /** Shows the deck at `zoom` with the page's origin at `x`,`y` in the canvas. */
    place(zoom: number, x: number, y: number) {
      return showView(page(), { zoom, panX: x, panY: y })
    },

    /** Selects these slides or layers, or nothing. */
    async select(ids: readonly string[]) {
      await page().evaluate((ids) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.select([...ids])
        store.requestRender()
      }, ids)
    },

    /** Adds a red box to a slide reaching past its right edge, selected, and returns its ID. */
    async addBoxPastRightEdge(slideId: string): Promise<string> {
      return page().evaluate((slideId) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const fill = { r: 0.9, g: 0.3, b: 0.2, a: 1 }
        const id = store.graph.createNode('RECTANGLE', slideId, {
          x: 1500,
          y: 300,
          width: 800,
          height: 400,
          fills: [{ type: 'SOLID', color: fill, opacity: 1, visible: true }]
        }).id
        store.select([id])
        return id
      }, slideId)
    },

    /** The slide on the stage, or null in Grid view. */
    async staged(): Promise<string | null> {
      return page().evaluate(() => window.openPencil?.getStore?.().state.focusedSlideId ?? null)
    },

    /** The deck's slide IDs by section, in order. */
    async order(): Promise<string[][]> {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) return []
        const grid = store.graph
          .getChildren(store.state.currentPageId)
          .find((node) => node.type === 'SLIDE_GRID')
        if (!grid) return []
        return store.graph.getChildren(grid.id).map((row) => [...row.childIds])
      })
    },

    /** A slide's speaker notes. */
    async notes(slideId: string): Promise<string> {
      return page().evaluate(
        (id) => window.openPencil?.getStore?.().graph.getNode(id)?.slide?.notes ?? '',
        slideId
      )
    },

    /** A slide's width and height. */
    async size(slideId: string): Promise<{ width: number; height: number } | null> {
      return page().evaluate((id) => {
        const node = window.openPencil?.getStore?.().graph.getNode(id)
        return node ? { width: node.width, height: node.height } : null
      }, slideId)
    },

    /** The deck's slide names by section, which are their numbers. */
    async names(): Promise<string[][]> {
      const order = await this.order()
      return page().evaluate((order) => {
        const graph = window.openPencil?.getStore?.().graph
        return order.map((row) => row.map((id) => graph?.getNode(id)?.name ?? ''))
      }, order)
    }
  }
}
