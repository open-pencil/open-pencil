import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot(`${name}.png`)
}

test('plus darker and plus lighter on layers, fills and strokes', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) {
      throw new Error('OpenPencil store not initialized')
    }
    const pageId = store.state.currentPageId
    const backdrops = [
      { r: 0.2, g: 0.45, b: 0.85, a: 1 },
      { r: 0.55, g: 0.55, b: 0.55, a: 1 },
      { r: 0.9, g: 0.6, b: 0.2, a: 1 }
    ]
    const paint = { r: 0.5, g: 0.35, b: 0.6, a: 1 }

    for (const [index, color] of backdrops.entries()) {
      store.graph.createNode('RECTANGLE', pageId, {
        name: `Backdrop ${index}`,
        x: 60 + index * 160,
        y: 60,
        width: 160,
        height: 320,
        fills: [{ type: 'SOLID', color, visible: true, opacity: 1 }]
      })
    }

    for (const [row, blendMode] of (['LINEAR_BURN', 'LINEAR_DODGE'] as const).entries()) {
      const y = 90 + row * 150
      store.graph.createNode('RECTANGLE', pageId, {
        name: `${blendMode} layer`,
        x: 80,
        y,
        width: 420,
        height: 36,
        blendMode,
        fills: [{ type: 'SOLID', color: paint, visible: true, opacity: 1 }]
      })
      store.graph.createNode('RECTANGLE', pageId, {
        name: `${blendMode} fill`,
        x: 80,
        y: y + 46,
        width: 420,
        height: 36,
        fills: [{ type: 'SOLID', color: paint, visible: true, opacity: 1, blendMode }]
      })
      store.graph.createNode('RECTANGLE', pageId, {
        name: `${blendMode} stroke`,
        x: 92,
        y: y + 98,
        width: 396,
        height: 12,
        fills: [],
        strokes: [
          {
            type: 'SOLID',
            color: paint,
            weight: 12,
            visible: true,
            opacity: 1,
            align: 'OUTSIDE',
            blendMode
          }
        ]
      })
    }
    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await expectCanvas('plus-darker-plus-lighter')
})
