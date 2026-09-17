import { readFile } from 'node:fs/promises'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { readScenePixels } from '#tests/helpers/canvas/pixels'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot(`${name}.png`)
}

test('FIT avatar preserves the full clipboard fixture image', async () => {
  const bytes = await readFile('tests/fixtures/vectorize/pilot_avatar.png')
  await editor.page.evaluate(
    (data) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const hash = store.storeImage(new Uint8Array(data))
      store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        name: 'Bitmap background',
        x: 80,
        y: 80,
        width: 320,
        height: 222,
        cornerRadius: 16,
        fills: [
          {
            type: 'SOLID',
            color: { r: 241 / 255, g: 245 / 255, b: 249 / 255, a: 1 },
            visible: true,
            opacity: 1
          }
        ]
      })
      store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        name: 'Pilot avatar · image fill FIT',
        x: 138,
        y: 90,
        width: 204,
        height: 202,
        fills: [
          {
            type: 'IMAGE',
            imageHash: hash,
            imageScaleMode: 'FIT',
            color: { r: 0, g: 0, b: 0, a: 1 },
            visible: true,
            opacity: 1
          }
        ]
      })
      store.clearSelection()
      store.requestRender()
    },
    [...bytes]
  )
  await editor.canvas.waitForRender()
  await expectCanvas('fit-avatar-clipboard-fixture')
})

test('gradients and image fill modes', async () => {
  await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId

    const imageCanvas = document.createElement('canvas')
    imageCanvas.width = 48
    imageCanvas.height = 32
    const ctx = imageCanvas.getContext('2d')
    if (!ctx) throw new Error('Cannot create image fixture canvas')
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(0, 0, 24, 16)
    ctx.fillStyle = '#3b82f6'
    ctx.fillRect(24, 0, 24, 16)
    ctx.fillStyle = '#14b8a6'
    ctx.fillRect(0, 16, 24, 16)
    ctx.fillStyle = '#facc15'
    ctx.fillRect(24, 16, 24, 16)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 3
    ctx.strokeRect(1.5, 1.5, 45, 29)
    const blob = await new Promise<Blob>((resolve, reject) => {
      imageCanvas.toBlob((result) => {
        if (result) {
          resolve(result)
          return
        }
        reject(new Error('Failed to encode image fixture'))
      }, 'image/png')
    })
    const imageHash = store.storeImage(new Uint8Array(await blob.arrayBuffer()))

    store.graph.createNode('FRAME', pageId, {
      name: 'Gradient and Image Backdrop',
      x: 56,
      y: 52,
      width: 700,
      height: 250,
      cornerRadius: 22,
      fills: [
        { type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.97, a: 1 }, visible: true, opacity: 1 }
      ]
    })

    const gradientStops = [
      { color: { r: 0.23, g: 0.51, b: 0.96, a: 1 }, position: 0 },
      { color: { r: 0.58, g: 0.27, b: 0.95, a: 1 }, position: 0.55 },
      { color: { r: 0.08, g: 0.73, b: 0.73, a: 1 }, position: 1 }
    ]
    const gradientTypes = [
      'GRADIENT_LINEAR',
      'GRADIENT_RADIAL',
      'GRADIENT_ANGULAR',
      'GRADIENT_DIAMOND'
    ] as const
    for (const [index, type] of gradientTypes.entries()) {
      store.graph.createNode('RECTANGLE', pageId, {
        name: `${type} visual`,
        x: 84 + index * 116,
        y: 84,
        width: 92,
        height: 72,
        cornerRadius: 16,
        fills: [
          {
            type,
            color: { r: 0, g: 0, b: 0, a: 1 },
            visible: true,
            opacity: 1,
            gradientStops,
            gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
          }
        ]
      })
    }

    store.graph.createNode('RECTANGLE', pageId, {
      name: 'FIT image with transparent margins',
      x: 568,
      y: 84,
      width: 140,
      height: 172,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1,
          imageHash,
          imageScaleMode: 'FIT'
        }
      ]
    })

    const scaleModes = ['FILL', 'FIT', 'TILE', 'CROP'] as const
    for (const [index, imageScaleMode] of scaleModes.entries()) {
      store.graph.createNode('RECTANGLE', pageId, {
        name: `${imageScaleMode} image visual`,
        x: 84 + index * 116,
        y: 184,
        width: 92,
        height: 72,
        cornerRadius: 14,
        fills: [
          {
            type: 'IMAGE',
            color: { r: 0, g: 0, b: 0, a: 1 },
            visible: true,
            opacity: 1,
            imageHash,
            imageScaleMode,
            imageTransform:
              imageScaleMode === 'CROP'
                ? { m00: 0.5, m01: 0, m02: 0.25, m10: 0, m11: 0.5, m12: 0.25 }
                : undefined
          }
        ],
        strokes: [
          {
            color: { r: 1, g: 1, b: 1, a: 0.9 },
            weight: 2,
            visible: true,
            opacity: 1,
            align: 'INSIDE'
          }
        ]
      })
    }

    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  const gradientPixels = await readScenePixels(
    editor.page,
    [0, 1, 2, 3].map((index) => ({ x: 130 + index * 116, y: 120 }))
  )
  for (const [r, g, b, a] of gradientPixels) {
    expect(a).toBe(255)
    expect(Math.min(r, g, b)).toBeLessThan(200)
  }
  await editor.canvas.waitForRender()
  await expectCanvas('gradients-and-image-fill-modes')
})
