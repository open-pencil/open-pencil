import type { Page } from '@playwright/test'

import type * as Geometry from '@open-pencil/core/geometry'

import type * as GradientScene from '#tests/helpers/canvas/gradient/scene'
import { pageScene, showView } from '#tests/helpers/canvas/page-scene'

type GradientType = Parameters<typeof GradientScene.createGradientScene>[2]

/** Builds a gradient scene, opens its fill picker, and reads the gradient back. */
export function gradientDriver(page: () => Page) {
  const scenes = pageScene<typeof GradientScene>(page, '/tests/helpers/canvas/gradient/scene.ts')
  return {
    /** The gradient rectangle, selected, at 200% with its top-left 100 px into the canvas. */
    async show(type: GradientType) {
      const { nodeId } = await scenes.build('createGradientScene', type)
      await page().evaluate((id) => window.openPencil?.getStore?.().select([id]), nodeId)
      await showView(page(), { zoom: 2, panX: 100, panY: 100 })
      return nodeId
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

    /** A linear gradient's start and end in the layer's own pixels. */
    ends(nodeId: string) {
      return page().evaluate(async (id) => {
        const node = window.openPencil?.getStore?.().graph.getNode(id)
        const transform = node?.fills[0]?.gradientTransform
        if (!node || !transform) return null
        const geometryURL = '/packages/core/src/geometry/gradient.ts'
        const geometry: typeof Geometry = await import(geometryURL)
        const { start, end } = geometry.gradientHandles(
          'GRADIENT_LINEAR',
          transform,
          node.width,
          node.height
        )
        return { start, end }
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
