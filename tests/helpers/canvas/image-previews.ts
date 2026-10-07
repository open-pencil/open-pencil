import type { Page } from '@playwright/test'

export async function createImagePreviewScene(page: Page) {
  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image fixture canvas unavailable')
    for (const [index, color] of ['#ef4444', '#3b82f6', '#14b8a6', '#facc15'].entries()) {
      context.fillStyle = color
      context.fillRect((index % 2) * 256, Math.floor(index / 2) * 128, 256, 128)
    }
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) {
          resolve(value)
          return
        }
        reject(new Error('Image encoding failed'))
      }, 'image/png')
    })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const hash = store.storeImage(bytes)
    // Activate the large-document policy without a binary fixture in Git.
    for (let i = 0; i < 128; i++) store.graph.images.set(`unused-preview-fixture-${i}`, bytes)
    for (const [index, imageScaleMode] of (['FILL', 'FIT', 'TILE', 'CROP'] as const).entries()) {
      const paint = {
        type: 'IMAGE' as const,
        imageHash: hash,
        imageScaleMode,
        color: { r: 0, g: 0, b: 0, a: 1 },
        visible: true,
        opacity: 1,
        imageTransform:
          imageScaleMode === 'CROP' ? { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 } : undefined
      }
      store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        name: `${imageScaleMode} preview`,
        x: 80 + index * 360,
        y: 80,
        width: 256,
        height: 256,
        fills: [paint],
        strokes: [{ ...paint, weight: 12, align: 'OUTSIDE' }]
      })
    }
    store.state.zoom = 0.5
    store.state.panX = 0
    store.state.panY = 0
    store.requestRender()
  })
}

export async function imagePreviewState(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const renderer = store?.canvasRenderers.find((value) => value.tracksSceneSettlement)
    if (!renderer || !store) throw new Error('Scene renderer unavailable')
    return {
      enabled: renderer.viewportImageRendering,
      idle: renderer.imagePreviews.idle,
      keys: [...renderer.imageCache.entries()].map(([key]) => key),
      weight: renderer.imageCache.weight,
      originals: store.graph.images.size
    }
  })
}
