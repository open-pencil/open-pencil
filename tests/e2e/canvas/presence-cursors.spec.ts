import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

test.use({ viewport: { width: 900, height: 700 } })

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('people and agents show arrows in their color, agents with an outlined sparkle label', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const card = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Card',
      x: 220,
      y: 220,
      width: 160,
      height: 100,
      fills: [
        { type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.92, a: 1 }, opacity: 1, visible: true }
      ]
    })
    const ana = { r: 0.92, g: 0.34, b: 0.29, a: 1 }
    const ben = { r: 0.2, g: 0.55, b: 0.95, a: 1 }
    store.state.panX = 0
    store.state.panY = 0
    store.state.zoom = 1
    store.state.presenceCursors = [
      { kind: 'person', name: 'Ana', color: ana, x: 120, y: 120 },
      { kind: 'agent', name: 'Fern', color: ana, x: 220, y: 220, selection: [card.id] },
      { kind: 'agent', name: 'Orbit', color: ben, x: 440, y: 180 }
    ]
    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(600, 420)).toMatchSnapshot(
    'presence-cursors.png'
  )
})
