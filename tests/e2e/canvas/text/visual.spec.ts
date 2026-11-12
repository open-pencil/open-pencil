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
          color: { r: 0, g: 0, b: 0, a: 1 },
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

test('decoration pieces take the colour of the last character they cover', async () => {
  // Recorded in Figma desktop 126 (scratch/pr-oracle/grouping/underline-canvas.png): an underline
  // breaks only around descenders, a strikethrough never, and each piece is painted as its last
  // character, not split where the fills change.
  await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const solid = (r: number, g: number, b: number) => ({
      type: 'SOLID' as const,
      color: { r, g, b, a: 1 },
      visible: true,
      opacity: 1
    })
    const [red, green, blue, orange] = [
      solid(0.9, 0.2, 0.15),
      solid(0.25, 0.6, 0.2),
      solid(0.1, 0.2, 0.95),
      solid(0.95, 0.55, 0.2)
    ]
    const rows = [
      {
        y: 60,
        decoration: 'UNDERLINE' as const,
        runs: [
          [0, 1, blue],
          [1, 5, red]
        ] as const
      },
      {
        y: 150,
        decoration: 'UNDERLINE' as const,
        runs: [
          [0, 1, red],
          [1, 1, green],
          [2, 3, blue],
          [5, 1, orange]
        ] as const
      },
      {
        y: 240,
        decoration: 'STRIKETHROUGH' as const,
        runs: [
          [0, 1, red],
          [1, 5, blue]
        ] as const
      }
    ]
    for (const row of rows) {
      store.graph.createNode('TEXT', pageId, {
        name: `Hey yo ${row.decoration} ${row.y}`,
        x: 80,
        y: row.y,
        width: 320,
        height: 72,
        text: 'Hey yo',
        fontSize: 56,
        textAutoResize: 'HEIGHT',
        textDecoration: row.decoration,
        fills: [solid(0.08, 0.1, 0.18)],
        styleRuns: row.runs.map(([start, length, fill]) => ({
          start,
          length,
          style: { fills: [fill] }
        }))
      })
    }

    store.clearSelection()
    await store.loadFontsForNodes(store.graph.getPages().flatMap((page) => page.childIds))
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await expectCanvas('text-decoration-colours')
})

test('text case by character range', async () => {
  await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const fills = [
      {
        type: 'SOLID' as const,
        color: { r: 0.08, g: 0.1, b: 0.18, a: 1 },
        visible: true,
        opacity: 1
      }
    ]
    const rows = [
      {
        text: 'upper words in a lower line',
        styleRuns: [{ start: 0, length: 11, style: { textCase: 'UPPER' as const } }]
      },
      {
        text: 'Title case midword stays put',
        styleRuns: [
          { start: 0, length: 10, style: { textCase: 'TITLE' as const } },
          { start: 13, length: 6, style: { textCase: 'TITLE' as const } }
        ]
      },
      {
        text: 'ALL CAPS TEXT WITH A QUIET END',
        textCase: 'UPPER' as const,
        styleRuns: [{ start: 19, length: 11, style: { textCase: 'LOWER' as const } }]
      }
    ]
    for (const [index, row] of rows.entries()) {
      store.graph.createNode('TEXT', pageId, {
        name: row.text,
        x: 100,
        y: 80 + index * 50,
        width: 560,
        height: 34,
        text: row.text,
        fontSize: 24,
        fontWeight: 500,
        textAutoResize: 'HEIGHT',
        textCase: row.textCase ?? 'ORIGINAL',
        styleRuns: row.styleRuns,
        fills
      })
    }
    store.clearSelection()
    await store.loadFontsForNodes(store.graph.getPages().flatMap((page) => page.childIds))
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await expectCanvas('text-case-by-range')
})
