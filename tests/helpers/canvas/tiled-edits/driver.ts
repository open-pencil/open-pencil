import type { Page } from '@playwright/test'

import { waitForSettledScene, pageScene } from '#tests/helpers/canvas/page-scene'
import type * as TiledEditScenes from '#tests/helpers/canvas/tiled-edits/scene'

/**
 * Edits layers of a small frame the way the editor does, and compares what the tiles show after
 * those edits with the same scene drawn again from nothing.
 */
export function tiledEditsDriver(page: () => Page) {
  const scenes = pageScene<typeof TiledEditScenes>(
    page,
    '/tests/helpers/canvas/tiled-edits/scene.ts'
  )
  const canvas = () => page().getByTestId('canvas-element')

  return {
    show: () => scenes.build('createSmallFrameScene'),

    /** How many visible tiles `act` rendered, once the scene settled after it. */
    async tilesRenderedBy(act: () => Promise<unknown>) {
      const count = () =>
        page().evaluate(() => {
          const store = window.openPencil?.getStore?.()
          const renderer = store?.canvasRenderers.find((r) => r.tracksSceneSettlement)
          if (!renderer) throw new Error('Scene renderer unavailable')
          return renderer.tiledScene.visibleTilesRendered
        })
      const before = await count()
      await act()
      await waitForSettledScene(page())
      return (await count()) - before
    },

    startEditing: (id: string) =>
      page().evaluate((nodeId) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.select([nodeId])
        store.startTextEditing(nodeId)
      }, id),

    stopEditing: () => page().keyboard.press('Escape'),

    type: (text: string) => page().keyboard.type(text),

    moveBy: (id: string, dx: number, dy: number) =>
      page().evaluate(
        ({ nodeId, x, y }) => {
          const store = window.openPencil?.getStore?.()
          const node = store?.graph.getNode(nodeId)
          if (!store || !node) throw new Error('Layer not found')
          store.updateNodeWithUndo(nodeId, { x: node.x + x, y: node.y + y }, 'Move')
        },
        { nodeId: id, x: dx, y: dy }
      ),

    recolour: (id: string) =>
      page().evaluate((nodeId) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.updateNodeWithUndo(
          nodeId,
          {
            fills: [
              { type: 'SOLID', color: { r: 0.9, g: 0.2, b: 0.25, a: 1 }, opacity: 1, visible: true }
            ]
          },
          'Change fill'
        )
      }, id),

    undo: () =>
      page().evaluate(() => {
        window.openPencil?.getStore?.().undoAction()
      }),

    /** The canvas as the tiles show it, then as the scene draws from nothing. */
    async tiledAndRedrawn() {
      await waitForSettledScene(page())
      const tiled = await canvas().screenshot()
      await page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const renderer = store?.canvasRenderers.find((r) => r.tracksSceneSettlement)
        if (!store || !renderer) throw new Error('Scene renderer unavailable')
        renderer.invalidateAllPictures()
        renderer.tiledScene.invalidate()
        store.requestRender()
      })
      await waitForSettledScene(page())
      return { tiled, redrawn: await canvas().screenshot() }
    }
  }
}
