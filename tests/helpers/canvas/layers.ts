import type { Page } from '@playwright/test'

import type { Vector } from '@open-pencil/scene-graph/primitives'

/** Probes and drivers for layers on the current page. */
export function layerDriver(page: () => Page) {
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
    autoLayoutWithItems(
      name: string,
      layoutMode: 'HORIZONTAL' | 'VERTICAL',
      itemNames: readonly string[]
    ): Promise<{ frame: string; items: string[] }> {
      return page().evaluate(
        ({ frameName, mode, names }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
            name: frameName,
            layoutMode: mode,
            width: 400,
            height: 120
          })
          const items = names.map(
            (itemName) =>
              store.graph.createNode('RECTANGLE', frame.id, {
                name: itemName,
                width: 80,
                height: 80
              }).id
          )
          store.select([items[0]])
          store.requestRender()
          return { frame: frame.id, items }
        },
        { frameName: name, mode: layoutMode, names: itemNames }
      )
    },

    /** Driver: a frame on the current page with `count` rectangles named `Child 1` and on. */
    frameWithChildren(name: string, count: number): Promise<{ frame: string; children: string[] }> {
      return page().evaluate(
        ({ frameName, childCount }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
            name: frameName,
            width: 400,
            height: 400
          })
          const children = Array.from(
            { length: childCount },
            (_, i) =>
              store.graph.createNode('RECTANGLE', frame.id, { name: `Child ${i + 1}`, x: i, y: i })
                .id
          )
          store.requestRender()
          return { frame: frame.id, children }
        },
        { frameName: name, childCount: count }
      )
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
