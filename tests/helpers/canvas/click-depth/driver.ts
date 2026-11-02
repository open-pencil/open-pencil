import type { Page } from '@playwright/test'

import type * as ClickDepthScenes from '#tests/helpers/canvas/click-depth/scene'

type SceneName = 'createClickDepthCards' | 'createNestedBoard' | 'createComponentChart'

/** Builds click-depth scenes and reads back what pointer input selected, hovered, or moved. */
/** `page` is read on each call, so a spec can create the driver before its page exists. */
export function clickDepthDriver(page: () => Page) {
  function build<Name extends SceneName>(name: Name) {
    return page().evaluate(async (scene) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const fixtureURL = '/tests/helpers/canvas/click-depth/scene.ts'
      const scenes: typeof ClickDepthScenes = await import(fixtureURL)
      const ids = scenes[scene](store.graph, store.state.currentPageId)
      store.clearSelection()
      store.requestRender()
      return ids
    }, name) as Promise<ReturnType<(typeof ClickDepthScenes)[Name]>>
  }

  return {
    cards: () => build('createClickDepthCards'),
    nestedBoard: () => build('createNestedBoard'),
    componentChart: () => build('createComponentChart'),

    /** Shows the page at `zoom` with the canvas origin at the top left. */
    zoomTo(zoom: number) {
      return page().evaluate((level) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.state.zoom = level
        store.state.panX = 0
        store.state.panY = 0
        store.requestRender()
      }, zoom)
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
        return { selected: [...store.state.selectedIds], hovered: store.state.hoveredNodeId }
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
