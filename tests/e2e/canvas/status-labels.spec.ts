import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('status pills beside section titles and dots after frame names, cut short when narrow', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const solid = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, visible: true, opacity: 1 }
    ]
    const section = store.graph.createNode('SECTION', pageId, {
      name: 'Checkout',
      x: 40,
      y: 60,
      width: 420,
      height: 220,
      fills: solid(0.96, 0.96, 0.96)
    })
    store.graph.createNode('FRAME', section.id, {
      name: 'Cart',
      x: 40,
      y: 60,
      width: 160,
      height: 120,
      fills: solid(1, 1, 1)
    })
    const changed = store.graph.createNode('SECTION', pageId, {
      name: 'Profile',
      x: 500,
      y: 60,
      width: 320,
      height: 220,
      fills: solid(0.26, 0.26, 0.26)
    })
    store.graph.createNode('FRAME', changed.id, {
      name: 'Avatar',
      x: 40,
      y: 60,
      width: 120,
      height: 120,
      fills: solid(1, 1, 1)
    })
    const ready = store.graph.createNode('FRAME', pageId, {
      name: 'Onboarding',
      x: 40,
      y: 360,
      width: 200,
      height: 140,
      fills: solid(1, 1, 1)
    })
    const edited = store.graph.createNode('FRAME', pageId, {
      name: 'Settings',
      x: 300,
      y: 360,
      width: 200,
      height: 140,
      fills: solid(1, 1, 1)
    })
    // Too narrow for the state's name: the title is cut short and the pill keeps only its dot.
    const narrow = store.graph.createNode('SECTION', pageId, {
      name: 'A narrow section',
      x: 600,
      y: 360,
      width: 150,
      height: 140,
      fills: solid(0.26, 0.26, 0.26)
    })
    const tight = store.graph.createNode('FRAME', pageId, {
      name: 'A frame named longer than it is wide',
      x: 600,
      y: 560,
      width: 120,
      height: 60,
      fills: solid(1, 1, 1)
    })
    store.setStatus([changed.id, ready.id, edited.id, narrow.id, tight.id], 'ready-for-dev')
    store.setStatus([section.id], 'completed')
    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot('status-labels.png', { maxDiffPixelRatio: 0, threshold: 0 })
})
