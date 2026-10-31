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
    }
  }
}
