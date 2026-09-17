import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot(`${name}.png`)
}

test('complex text fills preserve native paragraph layout', async () => {
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
