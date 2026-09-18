import type { Page } from '@playwright/test'

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

/** Keep the wide-gamut notice from resizing the canvas in rendering-fidelity tests. */
export async function dismissWideGamutBanner(page: Page) {
  const banner = page.getByTestId('wide-gamut-banner')
  await banner.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined)
  if (await banner.isVisible()) await page.getByTestId('wide-gamut-banner-dismiss').click()
}

/** Focus the demo's paint and effects page, where blends and masks live. */
export async function focusPaintEffects(page: Page) {
  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const paintPage = store.graph.getPages().find((candidate) => candidate.name.startsWith('03'))
    if (!paintPage) throw new Error('Demo paint page unavailable')
    store.setDocumentColorSpace('display-p3')
    if (store.state.currentPageId !== paintPage.id) await store.switchPage(paintPage.id)
  })
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const subject = store.graph.getChildren(store.state.currentPageId)[0]
    if (!subject) throw new Error('Demo paint page is empty')
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
