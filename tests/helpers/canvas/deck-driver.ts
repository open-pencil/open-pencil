import type { Page } from '@playwright/test'

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
    async place(zoom: number, x: number, y: number) {
      await page().evaluate(
        ({ zoom, x, y }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          Object.assign(store.state, { zoom, panX: x, panY: y })
          store.requestRender()
        },
        { zoom, x, y }
      )
    },

    /** The deck's slide names by section, which are their numbers. */
    async names(): Promise<string[][]> {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) return []
        const grid = store.graph
          .getChildren(store.state.currentPageId)
          .find((node) => node.type === 'SLIDE_GRID')
        if (!grid) return []
        return store.graph
          .getChildren(grid.id)
          .map((row) => store.graph.getChildren(row.id).map((slide) => slide.name))
      })
    }
  }
}
