import type { Page } from '@playwright/test'

import type { Vector } from '@open-pencil/scene-graph/primitives'

/** Read freshly painted scene pixels in sRGB, before WebGL discards its drawing buffer. */
export async function readScenePixels(page: Page, points: readonly Vector[]): Promise<number[][]> {
  return page.evaluate((points) => {
    const store = window.openPencil?.getStore?.()
    const renderer = store?.canvasRenderers.find((candidate) => candidate.tracksSceneSettlement)
    const source = document.querySelector<HTMLCanvasElement>(
      '[data-test-id="scene-canvas-element"]'
    )
    if (!store || !renderer || !source) throw new Error('Scene canvas unavailable')
    const copy = document.createElement('canvas')
    copy.width = source.width
    copy.height = source.height
    const context = copy.getContext('2d', { colorSpace: 'srgb' })
    if (!context) throw new Error('sRGB canvas unavailable')
    renderer.renderFromEditorState(
      store.state,
      store.graph,
      store.textEditor,
      renderer.viewportWidth,
      renderer.viewportHeight,
      false,
      'scene',
      true
    )
    context.drawImage(source, 0, 0)
    const pixels = points.map((point) =>
      Array.from(
        context.getImageData(
          Math.floor(point.x * devicePixelRatio),
          Math.floor(point.y * devicePixelRatio),
          1,
          1
        ).data
      )
    )
    store.requestRepaint()
    return pixels
  }, points)
}
