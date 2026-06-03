import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.canvas.screenshot()
  expect(buffer).toMatchSnapshot(`${name}.png`)
}

test('boolean operations', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const operations = ['UNION', 'SUBTRACT', 'INTERSECT', 'EXCLUDE'] as const
    const colors = [
      { r: 0.23, g: 0.51, b: 0.96, a: 1 },
      { r: 0.96, g: 0.35, b: 0.35, a: 1 },
      { r: 0.08, g: 0.73, b: 0.73, a: 1 },
      { r: 0.58, g: 0.27, b: 0.95, a: 1 }
    ]

    for (const [index, operation] of operations.entries()) {
      const group = store.graph.createNode('BOOLEAN_OPERATION', pageId, {
        name: `${operation} visual`,
        x: 72 + index * 152,
        y: 92,
        width: 124,
        height: 104,
        booleanOperation: operation,
        fills: [{ type: 'SOLID', color: colors[index], visible: true, opacity: 1 }],
        strokes: [
          {
            color: { r: 0.08, g: 0.1, b: 0.18, a: 0.32 },
            weight: 2,
            visible: true,
            opacity: 1,
            align: 'CENTER'
          }
        ]
      })
      store.graph.createNode('RECTANGLE', group.id, {
        name: `${operation} rectangle`,
        x: 0,
        y: 18,
        width: 82,
        height: 70,
        cornerRadius: 14
      })
      store.graph.createNode('ELLIPSE', group.id, {
        name: `${operation} ellipse`,
        x: 42,
        y: 0,
        width: 82,
        height: 104
      })
    }

    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await expectCanvas('boolean-operations')
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
          { type, color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1, gradientStops }
        ]
      })
    }

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
  await expectCanvas('gradients-and-image-fill-modes')
})

test('complex text fills render as glyph outlines', async () => {
  await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId

    store.graph.createNode('FRAME', pageId, {
      name: 'Complex text fill visual backdrop',
      x: 64,
      y: 56,
      width: 660,
      height: 220,
      cornerRadius: 22,
      fills: [
        { type: 'SOLID', color: { r: 0.96, g: 0.97, b: 0.99, a: 1 }, visible: true, opacity: 1 }
      ]
    })

    store.graph.createNode('TEXT', pageId, {
      name: 'Gradient outline text visual',
      x: 96,
      y: 88,
      width: 560,
      height: 96,
      text: 'OPEN',
      fontFamily: 'Inter',
      fontSize: 88,
      fontWeight: 700,
      textAutoResize: 'NONE',
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 0.23, g: 0.51, b: 0.96, a: 1 } },
            { position: 0.5, color: { r: 0.08, g: 0.73, b: 0.73, a: 1 } },
            { position: 1, color: { r: 0.58, g: 0.27, b: 0.95, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })

    store.graph.createNode('TEXT', pageId, {
      name: 'Solid control text visual',
      x: 100,
      y: 188,
      width: 520,
      height: 34,
      text: 'solid text remains paragraph-rendered',
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 500,
      textAutoResize: 'HEIGHT',
      fills: [
        { type: 'SOLID', color: { r: 0.08, g: 0.1, b: 0.18, a: 1 }, visible: true, opacity: 1 }
      ]
    })

    store.clearSelection()
    await store.loadFontsForNodes(store.graph.getPages().flatMap((page) => page.childIds))
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await expectCanvas('complex-text-fills-as-outlines')
})

test('text decoration styles and OpenType features', async () => {
  await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId

    store.graph.createNode('FRAME', pageId, {
      name: 'Text decoration visual backdrop',
      x: 64,
      y: 56,
      width: 660,
      height: 220,
      cornerRadius: 22,
      fills: [
        { type: 'SOLID', color: { r: 0.96, g: 0.97, b: 0.99, a: 1 }, visible: true, opacity: 1 }
      ]
    })

    const rows = [
      {
        text: 'Wavy underline in red',
        y: 92,
        textDecoration: 'UNDERLINE' as const,
        textDecorationStyle: 'WAVY' as const,
        textDecorationThickness: 2,
        textDecorationFills: [
          {
            type: 'SOLID' as const,
            color: { r: 0.96, g: 0.26, b: 0.21, a: 1 },
            visible: true,
            opacity: 1
          }
        ]
      },
      {
        text: 'Dotted underline in blue',
        y: 142,
        textDecoration: 'UNDERLINE' as const,
        textDecorationStyle: 'DOTTED' as const,
        textDecorationThickness: 2.5,
        textDecorationFills: [
          {
            type: 'SOLID' as const,
            color: { r: 0.23, g: 0.51, b: 0.96, a: 1 },
            visible: true,
            opacity: 1
          }
        ]
      },
      {
        text: 'OpenType tags: oldstyle 0123456789 + ss01',
        y: 192,
        fontFeatures: [
          { tag: 'ONUM', enabled: true },
          { tag: 'SS01', enabled: true },
          { tag: 'KERN', enabled: false }
        ]
      }
    ]

    for (const row of rows) {
      store.graph.createNode('TEXT', pageId, {
        name: row.text,
        x: 100,
        y: row.y,
        width: 520,
        height: 34,
        text: row.text,
        fontSize: 24,
        fontWeight: 600,
        textAutoResize: 'HEIGHT',
        textDecoration: row.textDecoration ?? 'NONE',
        textDecorationStyle: row.textDecorationStyle ?? 'SOLID',
        textDecorationThickness: row.textDecorationThickness ?? null,
        textDecorationFills: row.textDecorationFills ?? [],
        fontFeatures: row.fontFeatures ?? [],
        fills: [
          { type: 'SOLID', color: { r: 0.08, g: 0.1, b: 0.18, a: 1 }, visible: true, opacity: 1 }
        ]
      })
    }

    store.clearSelection()
    await store.loadFontsForNodes(store.graph.getPages().flatMap((page) => page.childIds))
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await expectCanvas('text-decoration-styles-and-opentype-features')
})

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
