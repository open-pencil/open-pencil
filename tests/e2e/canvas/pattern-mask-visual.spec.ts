import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot(`${name}.png`)
}

test('pattern fills from source nodes', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId

    const source = store.graph.createNode('ELLIPSE', pageId, {
      name: 'Pattern source dot',
      x: -1000,
      y: -1000,
      width: 18,
      height: 18,
      visible: false,
      fills: [
        { type: 'SOLID', color: { r: 0.96, g: 0.35, b: 0.12, a: 1 }, visible: true, opacity: 1 }
      ]
    })

    store.graph.createNode('RECTANGLE', pageId, {
      name: 'Pattern fill visual',
      x: 84,
      y: 80,
      width: 240,
      height: 150,
      cornerRadius: 18,
      fills: [
        {
          type: 'PATTERN',
          sourceNodeId: source.id,
          patternTileType: 'HORIZONTAL_HEXAGONAL',
          scale: 1.25,
          patternSpacing: { x: 0.45, y: 0.35 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'CENTER',
          color: { r: 0.96, g: 0.35, b: 0.12, a: 1 },
          visible: true,
          opacity: 1
        }
      ],
      strokes: [
        {
          color: { r: 0.08, g: 0.1, b: 0.18, a: 0.18 },
          weight: 2,
          visible: true,
          opacity: 1,
          align: 'INSIDE'
        }
      ]
    })

    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await expectCanvas('pattern-fills-from-source-nodes')
})

test('luminance masks and transformed tile fills', async () => {
  await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId

    const imageCanvas = document.createElement('canvas')
    imageCanvas.width = 32
    imageCanvas.height = 32
    const ctx = imageCanvas.getContext('2d')
    if (!ctx) throw new Error('Cannot create tile fixture canvas')
    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, 32, 32)
    ctx.fillStyle = '#f97316'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#38bdf8'
    ctx.fillRect(16, 16, 16, 16)
    ctx.fillStyle = '#facc15'
    ctx.fillRect(20, 4, 8, 8)
    const blob = await new Promise<Blob>((resolve, reject) => {
      imageCanvas.toBlob((result) => {
        if (result) {
          resolve(result)
          return
        }
        reject(new Error('Failed to encode tile fixture'))
      }, 'image/png')
    })
    const imageHash = store.storeImage(new Uint8Array(await blob.arrayBuffer()))

    store.graph.createNode('RECTANGLE', pageId, {
      name: 'Transformed tile fill visual',
      x: 80,
      y: 76,
      width: 180,
      height: 130,
      cornerRadius: 18,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1,
          imageHash,
          imageScaleMode: 'TILE',
          imageTransform: { m00: 3, m01: 0, m02: 0, m10: 0, m11: 3, m12: 0 }
        }
      ],
      strokes: [
        {
          color: { r: 1, g: 1, b: 1, a: 0.85 },
          weight: 2,
          visible: true,
          opacity: 1,
          align: 'INSIDE'
        }
      ]
    })

    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Luminance mask stack visual',
      x: 320,
      y: 76,
      width: 240,
      height: 130,
      cornerRadius: 18,
      fills: [
        { type: 'SOLID', color: { r: 0.08, g: 0.1, b: 0.18, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    store.graph.createNode('RECTANGLE', frame.id, {
      name: 'Luminance mask gradient',
      x: 24,
      y: 20,
      width: 192,
      height: 90,
      isMask: true,
      maskType: 'LUMINANCE',
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 0, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1,
          gradientStops: [
            { color: { r: 0, g: 0, b: 0, a: 1 }, position: 0 },
            { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })
    for (let index = 0; index < 5; index++) {
      store.graph.createNode('RECTANGLE', frame.id, {
        name: `Masked color stripe ${index + 1}`,
        x: 24 + index * 38,
        y: 20,
        width: 34,
        height: 90,
        fills: [
          {
            type: 'SOLID',
            color: [
              { r: 0.96, g: 0.35, b: 0.35, a: 1 },
              { r: 0.96, g: 0.64, b: 0.16, a: 1 },
              { r: 0.08, g: 0.73, b: 0.73, a: 1 },
              { r: 0.23, g: 0.51, b: 0.96, a: 1 },
              { r: 0.58, g: 0.27, b: 0.95, a: 1 }
            ][index],
            visible: true,
            opacity: 1
          }
        ]
      })
    }

    const multiMaskFrame = store.graph.createNode('FRAME', pageId, {
      name: 'Consecutive mask stack visual',
      x: 620,
      y: 76,
      width: 220,
      height: 130,
      cornerRadius: 18,
      fills: [
        { type: 'SOLID', color: { r: 0.08, g: 0.1, b: 0.18, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    store.graph.createNode('ELLIPSE', multiMaskFrame.id, {
      name: 'First combined mask',
      x: 18,
      y: 16,
      width: 112,
      height: 98,
      isMask: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    store.graph.createNode('ELLIPSE', multiMaskFrame.id, {
      name: 'Second combined mask',
      x: 90,
      y: 16,
      width: 112,
      height: 98,
      isMask: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    store.graph.createNode('RECTANGLE', multiMaskFrame.id, {
      name: 'Consecutively masked content',
      x: 18,
      y: 16,
      width: 184,
      height: 98,
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 0, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1,
          gradientStops: [
            { color: { r: 0.96, g: 0.35, b: 0.35, a: 1 }, position: 0 },
            { color: { r: 0.08, g: 0.73, b: 0.73, a: 1 }, position: 0.5 },
            { color: { r: 0.58, g: 0.27, b: 0.95, a: 1 }, position: 1 }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })

    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await expectCanvas('luminance-masks-and-transformed-tile-fills')
})
