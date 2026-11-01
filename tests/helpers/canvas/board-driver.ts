import type { Page } from '@playwright/test'

/** A FigJam board in the open document: its kind, its page, and the view it shows. */
export function boardDriver(page: () => Page) {
  return {
    /** Makes the open document a board on FigJam's #F5F5F5 page, as New board starts one. */
    async open() {
      await page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.setDocumentKind('board')
        store.state.pageColor = { r: 245 / 255, g: 245 / 255, b: 245 / 255, a: 1 }
        store.requestRender()
      })
    },

    /** Makes the open document a design again, which reopens its panels, for the tests after. */
    async close() {
      await page().evaluate(() => {
        window.openPencil?.getStore?.().setDocumentKind('design')
      })
    },

    /** Shows the board at `zoom` with the canvas origin at the view's top-left corner. */
    async showAt(zoom: number) {
      await page().evaluate((zoom) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.state.zoom = zoom
        store.state.panX = 0
        store.state.panY = 0
        store.requestRender()
      }, zoom)
    },

    /** Adds a rectangle, which a board keeps though its tools draw none. */
    async addRectangle(x: number, y: number, width: number, height: number) {
      await page().evaluate(
        ({ x, y, width, height }) => {
          window.openPencil?.getStore?.().createShape('RECTANGLE', x, y, width, height)
        },
        { x, y, width, height }
      )
    },

    /** Adds a text layer or a section at canvas `x`,`y` and selects it. */
    async addSelected(
      type: 'TEXT' | 'SECTION',
      x: number,
      y: number,
      width: number,
      height: number
    ) {
      await page().evaluate(
        ({ type, x, y, width, height }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          const id = store.createShape(type, x, y, width, height)
          if (type === 'TEXT') store.graph.updateNode(id, { text: 'Board text' })
          store.select([id])
          store.requestRender()
        },
        { type, x, y, width, height }
      )
    },

    /** Selects every layer on the board's page. */
    async selectAll() {
      await page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.select(store.graph.getChildren(store.state.currentPageId).map((node) => node.id))
      })
    },

    /** The first fill of the selected layer as 0–255 RGB, or null when it has none. */
    async selectedFill() {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const id = store ? [...store.state.selectedIds][0] : undefined
        const color = id ? store?.graph.getNode(id)?.fills[0]?.color : undefined
        return color ? [color.r, color.g, color.b].map((c) => Math.round(c * 255)) : null
      })
    },

    /** The types of the layers directly on the board's page, in order. */
    async layerTypes() {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        return store?.graph.getChildren(store.state.currentPageId).map((node) => node.type)
      })
    }
  }
}
