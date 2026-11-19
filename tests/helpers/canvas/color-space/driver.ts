import type { Page } from '@playwright/test'

import { pageScene, waitForSettledScene } from '../page-scene'
import type * as WideGamutScene from './scene'

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
  if (!(await banner.isVisible())) return
  await banner.locator('[data-slot="banner-dismiss"]').click()
  // The canvas takes the notice's room once it has left the layout, not when it is clicked.
  await banner.waitFor({ state: 'detached' })
}

/** Builds the wide gamut scene in a Display P3 document. */
export async function showWideGamutScene(page: Page) {
  await page.evaluate(() => window.openPencil?.getStore?.().setDocumentColorSpace('display-p3'))
  const { frameId } = await pageScene<typeof WideGamutScene>(
    () => page,
    '/tests/helpers/canvas/color-space/scene.ts'
  ).build('createWideGamutScene')
  return frameId
}

/** Fits the wide gamut scene's frame in the canvas. */
export async function focusWideGamutScene(page: Page, frameId: string) {
  // Zooming to a layer fits the viewport size the editor last measured, and the canvas follows
  // its area through a resize observer, so a resize, of the window or of the area when the notice
  // goes, must reach both first or the zoom fits the old size. The canvas sizes its pixels in the
  // same step.
  await page.waitForFunction(() => {
    const area = document.querySelector<HTMLElement>('[data-test-id="canvas-area"]')
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-test-id="scene-canvas-element"]'
    )
    const viewport = window.openPencil?.getStore?.().getViewportSize()
    const dpr = window.devicePixelRatio || 1
    return (
      !!area &&
      !!canvas &&
      !!viewport &&
      viewport.width === area.clientWidth &&
      viewport.height === area.clientHeight &&
      canvas.width === Math.round(area.clientWidth * dpr) &&
      canvas.height === Math.round(area.clientHeight * dpr)
    )
  })
  await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    store.select([id])
    store.zoomToSelection()
    store.clearSelection()
  }, frameId)
  await waitForSettledScene(page)
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
