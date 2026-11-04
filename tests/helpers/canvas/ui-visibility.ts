import type { Page } from '@playwright/test'

import type { Vector } from '@open-pencil/scene-graph/primitives'

/** The document point beneath a canvas-local pixel. */
export function readCanvasWorldPoint(page: Page, point: Vector) {
  return page.evaluate(({ x, y }) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    return store.screenToCanvas(x, y)
  }, point)
}

/** Wait for both visible tiles and their background work before measuring new scene work. */
export async function waitForIdleCanvas(page: Page) {
  await page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    return (
      store &&
      store.canvasRenderers.some((r) => r.tracksSceneSettlement) &&
      store.canvasRenderers.every(
        (r) =>
          !r.tracksSceneSettlement ||
          (r.tiledSceneCovered && !r.tiledScenePending && !r.tiledSceneBackgroundPending)
      )
    )
  })
}

/** Scoped observation of canvas lifetimes and scene work during a UI-only interaction. */
export function observeCanvasContinuity(page: Page) {
  return page.evaluateHandle(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const canvases = [...document.querySelectorAll('canvas[data-ready="1"]')]
    const renderers = [...store.canvasRenderers]
    let sceneFrames = 0
    let replacements = 0
    const restores = renderers.map((renderer) => {
      const render = renderer.renderFromEditorState
      const replace = renderer.replaceSurface
      renderer.renderFromEditorState = (...args) => {
        if (args[6] === 'scene') sceneFrames++
        return render.apply(renderer, args)
      }
      renderer.replaceSurface = (...args) => {
        replacements++
        return replace.apply(renderer, args)
      }
      return () => {
        renderer.renderFromEditorState = render
        renderer.replaceSurface = replace
      }
    })
    return {
      read() {
        const current = [...store.canvasRenderers]
        return {
          connected: canvases.every((canvas) => canvas.isConnected),
          sameRenderers:
            current.length === renderers.length && renderers.every((r) => current.includes(r)),
          sceneFrames,
          replacements
        }
      },
      restore() {
        restores.forEach((restore) => restore())
      }
    }
  })
}

/** Geometry of the canvas buffers and the artwork currently selected, in screen coordinates. */
export function readCanvasPosition(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const { panX, panY, zoom } = store.state
    const surfaces = [
      ...document.querySelectorAll<HTMLCanvasElement>('canvas[data-ready="1"]')
    ].map((canvas) => {
      const { x, y, width, height } = canvas.getBoundingClientRect()
      return { x, y, width, height, bufferWidth: canvas.width, bufferHeight: canvas.height }
    })
    return { panX, panY, zoom, surfaces }
  })
}

/** Where the selected layer and guide are drawn, relative to the canvas. */
export function readCanvasNavigation(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const { panX, panY, zoom } = store.state
    const [id] = store.state.selectedIds
    const node = id ? store.graph.getNode(id) : undefined
    const guideSelection = store.state.guides.selected
    const owner = guideSelection ? store.graph.getNode(guideSelection.ownerId) : undefined
    const guide = owner?.guides.find((guide) => guide.id === guideSelection?.guideId)
    const origin = owner ? store.graph.getAbsolutePosition(owner.id) : { x: 0, y: 0 }
    return {
      selection: node
        ? {
            x: node.x * zoom + panX,
            y: node.y * zoom + panY,
            width: node.width * zoom,
            height: node.height * zoom
          }
        : null,
      guide: guide
        ? {
            axis: guide.axis,
            screenPosition:
              guide.axis === 'x'
                ? (origin.x + guide.position) * zoom + panX
                : (origin.y + guide.position) * zoom + panY
          }
        : null
    }
  })
}
