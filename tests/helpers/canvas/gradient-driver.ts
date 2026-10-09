import type { Page } from '@playwright/test'

import type * as GradientScene from '#tests/helpers/canvas/gradient'

type GradientType = Parameters<typeof GradientScene.createGradientScene>[2]

/** Builds a gradient scene, opens its fill picker, and reads the gradient back. */
export function gradientDriver(page: () => Page) {
  return {
    /** The gradient rectangle, selected, at 200% with its top-left 100 px into the canvas. */
    async show(type: GradientType) {
      return page().evaluate(async (type) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const fixtureURL = '/tests/helpers/canvas/gradient.ts'
        const scene: typeof GradientScene = await import(fixtureURL)
        const { nodeId } = scene.createGradientScene(store.graph, store.state.currentPageId, type)
        store.select([nodeId])
        store.state.zoom = 2
        store.state.panX = 100
        store.state.panY = 100
        store.requestRender()
        return nodeId
      }, type)
    },

    /** Canvas coordinates of a point in the layer's own pixels. */
    point(x: number, y: number) {
      return { x: 100 + x * 2, y: 100 + y * 2 }
    },

    fill(nodeId: string) {
      return page().evaluate((id) => {
        const fill = window.openPencil?.getStore?.().graph.getNode(id)?.fills[0]
        return fill
          ? {
              transform: fill.gradientTransform,
              stops: fill.gradientStops?.map((stop) => stop.position)
            }
          : null
      }, nodeId)
    },

    editedStop() {
      return page().evaluate(() => window.openPencil?.getStore?.().state.gradientEdit?.stop ?? null)
    },

    /** Shows the handles without the picker, as when its fill picker is open. */
    edit(nodeId: string) {
      return page().evaluate((nodeId) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.state.gradientEdit = { nodeId, paint: 'fills', index: 0, stop: 1 }
        store.requestRender()
      }, nodeId)
    },

    editing() {
      return page().evaluate(() => Boolean(window.openPencil?.getStore?.().state.gradientEdit))
    }
  }
}
