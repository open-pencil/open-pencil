import type { Page } from '@playwright/test'

import type * as ClickDepthScenes from '#tests/helpers/canvas/click-depth/scene'
import { pageScene, showView } from '#tests/helpers/canvas/page-scene'

/** Builds click-depth scenes and reads back what pointer input selected, hovered, or moved. */
/** `page` is read on each call, so a spec can create the driver before its page exists. */
export function clickDepthDriver(page: () => Page) {
  const scenes = pageScene<typeof ClickDepthScenes>(
    page,
    '/tests/helpers/canvas/click-depth/scene.ts'
  )
  const build = scenes.build

  return {
    cards: () => build('createClickDepthCards'),
    nestedBoard: () => build('createNestedBoard'),
    componentChart: () => build('createComponentChart'),

    /** Builds the scope tree and opens the layer rows of its two leaves. */
    async scopeTree() {
      const ids = await build('createScopeTree')
      await page().evaluate(
        (leaves) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          store.select(leaves)
          store.clearSelection()
        },
        [ids.a, ids.c]
      )
      return ids
    },

    /** Shows the page at `zoom` with the canvas origin at the top left. */
    zoomTo(zoom: number) {
      return showView(page(), { zoom, panX: 0, panY: 0 })
    },

    /** Canvas coordinates of a point given relative to a node's top-left corner. */
    at(id: string, dx: number, dy: number) {
      return page().evaluate(
        ({ id, dx, dy }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          const abs = store.graph.getAbsolutePosition(id)
          const { zoom, panX, panY } = store.state
          return { x: (abs.x + dx) * zoom + panX, y: (abs.y + dy) * zoom + panY }
        },
        { id, dx, dy }
      )
    },

    state() {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        return {
          selected: [...store.state.selectedIds],
          hovered: store.state.hoveredNodeId,
          entered: store.state.enteredContainerId
        }
      })
    },

    children(id: string) {
      return page().evaluate(
        (nodeId) => window.openPencil?.getStore?.().graph.getNode(nodeId)?.childIds ?? [],
        id
      )
    },

    position(id: string) {
      return page().evaluate((nodeId) => {
        const node = window.openPencil?.getStore?.().graph.getNode(nodeId)
        return node ? { x: node.x, y: node.y } : null
      }, id)
    }
  }
}
