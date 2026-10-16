import type { Page } from '@playwright/test'

import type * as PaintScene from '#tests/helpers/canvas/paint-effects/scene'

/** Exercise the P3 surface negotiation even on an sRGB CI display. */
export async function emulateWideGamutDisplay(page: Page) {
  await page.addInitScript(() => {
    const matchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query) => {
      const result = matchMedia(query)
      if (query === '(color-gamut: p3)') Object.defineProperty(result, 'matches', { value: true })
      return result
    }
  })
}

/** The wide-gamut notice is the only capability banner whose content names Display-P3. */
export function wideGamutBanner(page: Page) {
  return page.getByRole('status').filter({ hasText: 'Display-P3' })
}

/** Keep the wide-gamut notice from resizing the canvas in rendering-fidelity tests. */
export async function dismissWideGamutBanner(page: Page) {
  const banner = wideGamutBanner(page)
  await banner.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined)
  if (await banner.isVisible()) await banner.locator('[data-slot="banner-dismiss"]').click()
}

/** Builds a stable paint subject independently of the editable product tour. */
export async function showPaintEffects(page: Page) {
  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const sceneURL = '/tests/helpers/canvas/paint-effects/scene.ts'
    const scene: typeof PaintScene = await import(sceneURL)
    await scene.createPaintEffectsScene(store.graph, store.state.currentPageId)
    store.setDocumentColorSpace('display-p3')
    store.requestRender()
  })
}

/** Focus the paint fixture's original blend, mask, fill and effect specimens. */
export async function focusPaintEffects(page: Page) {
  // Zooming to a layer uses the viewport size the canvas last measured, so a window resize must
  // reach it first or the zoom fits the old size. The canvas sizes its pixels in the same step.
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-test-id="scene-canvas-element"]'
    )
    const dpr = window.devicePixelRatio || 1
    return (
      !!canvas &&
      canvas.width === Math.round(canvas.clientWidth * dpr) &&
      canvas.height === Math.round(canvas.clientHeight * dpr)
    )
  })
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const subject = store.graph
      .getChildren(store.state.currentPageId)
      .find((node) => node.name === 'Paint and effects')
    if (!subject) throw new Error('Paint fixture unavailable')
    store.select([subject.id])
    store.zoomToSelection()
    store.clearSelection()
  })
}

export async function waitForSettledScene(page: Page) {
  await page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    const renderer = store?.canvasRenderers.find((r) => r.tracksSceneSettlement)
    return (
      store?.state.navigation.phase === 'idle' &&
      renderer &&
      !renderer.sceneBackingNeedsCrispRender &&
      !renderer.sceneBackingBuild
    )
  })
}

export async function sceneBufferState(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-test-id="scene-canvas-element"]'
    )
    const gl = canvas?.getContext('webgl2')
    if (!gl) throw new Error('Scene WebGL context unavailable')
    return {
      colorSpace: gl.drawingBufferColorSpace,
      documentColorSpace: window.openPencil?.getStore?.().graph.documentColorSpace,
      error: gl.getError()
    }
  })
}
