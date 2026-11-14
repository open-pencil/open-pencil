import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

// Figma desktop 126: layers inside a component or an instance outline in the component purple.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('layers inside a component and an instance outline in component purple', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const fill = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, visible: true, opacity: 1 }
    ]
    const card = graph.createNode('COMPONENT', pageId, {
      name: 'Card',
      x: 120,
      y: 120,
      width: 160,
      height: 100,
      fills: fill(1, 1, 1)
    })
    const rect = graph.createNode('RECTANGLE', card.id, {
      name: 'Card Rect',
      x: 20,
      y: 20,
      width: 60,
      height: 40,
      fills: fill(0.6, 0.6, 0.6)
    })
    const instance = graph.createInstance(card.id, pageId, { x: 340, y: 120 })
    store.select([rect.id])
    store.state.hoveredNodeId = instance ? (graph.getChildren(instance.id)[0]?.id ?? null) : null
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion(600, 320)
  expect(buffer).toMatchSnapshot('component-descendant-outlines.png', {
    maxDiffPixelRatio: 0,
    threshold: 0
  })
})

// Figma desktop (2026-11-14) clips a component set like a frame: a variant past its edge is cut.
test('a component set clips a variant that reaches past its edge', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const fill = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, visible: true, opacity: 1 }
    ]
    const set = graph.createNode('COMPONENT_SET', store.state.currentPageId, {
      name: 'Buttons',
      x: 120,
      y: 120,
      width: 200,
      height: 120,
      clipsContent: true,
      fills: fill(1, 1, 1)
    })
    graph.createNode('COMPONENT', set.id, {
      name: 'State=Wide',
      x: 20,
      y: 20,
      width: 260,
      height: 80,
      fills: fill(0.23, 0.51, 0.96)
    })
    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion(600, 320)
  expect(buffer).toMatchSnapshot('component-set-clips-variant.png', {
    maxDiffPixelRatio: 0,
    threshold: 0
  })
})
