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
    },

    /** Animates a new box onto a slide on a click, and returns its ID. */
    async addAnimatedBox(slideId: string, name = 'Box'): Promise<string> {
      return page().evaluate(
        ({ slideId, name }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          const box = store.graph.createNode('ELLIPSE', slideId, {
            name,
            x: 200,
            y: 200,
            width: 300,
            height: 300,
            fills: [
              { type: 'SOLID', color: { r: 0.2, g: 0.5, b: 1, a: 1 }, opacity: 1, visible: true }
            ]
          })
          store.addLayerAnimations([box.id])
          return box.id
        },
        { slideId, name }
      )
    },

    /** Moves a layer onto a slide at `x`, `y`. */
    async placeOnSlide(layerId: string, slideId: string, x: number, y: number) {
      await page().evaluate(
        ({ layerId, slideId, x, y }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          store.graph.reparentNode(layerId, slideId)
          store.graph.updateNode(layerId, { x, y })
        },
        { layerId, slideId, x, y }
      )
    },

    /** Sets a slide's speaker notes. */
    async setNotes(slideId: string, notes: string) {
      await page().evaluate(
        ({ slideId, notes }) => window.openPencil?.getStore?.().setSlideNotes(slideId, notes),
        { slideId, notes }
      )
    },

    /** The style of a slide's transition, or undefined without one. */
    async transitionStyle(slideId: string): Promise<string | undefined> {
      return page().evaluate(
        (id) => window.openPencil?.getStore?.().graph.getNode(id)?.slide?.transition?.style,
        slideId
      )
    },

    /** Presents the deck from a slide, or from its start. */
    async present(slideId?: string) {
      await page().evaluate((id) => window.openPencil?.getStore?.().present(id), slideId)
    },

    /** Ends the presentation, if one is on. */
    async stopPresenting() {
      await page().evaluate(() => window.openPencil?.getStore?.().stopPresenting())
    },

    /** Where the presentation is: the slide on show, the steps of its build played, and all slides. */
    async presentation(): Promise<{ index: number; played: number; slideIds: string[] } | null> {
      return page().evaluate(() => {
        const status = window.openPencil?.getStore?.().state.presentation
        return status
          ? { index: status.index, played: status.played, slideIds: [...status.slideIds] }
          : null
      })
    },

    /** Animates a new box out of `parentId` on a click, and returns its ID. */
    async addExitingBox(parentId: string): Promise<string> {
      return page().evaluate((parentId) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const box = store.graph.createNode('RECTANGLE', parentId, {
          name: 'Leaving',
          x: 120,
          y: 0,
          width: 40,
          height: 40
        })
        store.addLayerAnimations([box.id])
        store.setLayerAnimations([box.id], (current) => ({ ...current, phase: 'OUT' }))
        return box.id
      }, parentId)
    }
  }
}
