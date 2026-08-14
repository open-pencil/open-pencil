import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('Option hover shows temporary distances between layers', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const pageId = store.state.currentPageId
    const selected = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Selected',
      x: 120,
      y: 140,
      width: 100,
      height: 80,
      fills: [
        { type: 'SOLID', color: { r: 0.25, g: 0.52, b: 0.96, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    store.graph.createNode('RECTANGLE', pageId, {
      name: 'Target',
      x: 300,
      y: 290,
      width: 120,
      height: 90,
      fills: [
        { type: 'SOLID', color: { r: 0.95, g: 0.55, b: 0.2, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    store.select([selected.id])
    store.requestRender()
  })
  await editor.canvas.waitForRender()

  await editor.canvas.hover(340, 330)
  await editor.page.keyboard.down('Alt')
  await expect
    .poll(() => editor.page.evaluate(() => window.openPencil?.getStore?.().state.measurementMode))
    .toBe('shallow')
  await editor.canvas.waitForRender()

  expect(
    await editor.page.screenshot({
      clip: { x: 80, y: 90, width: 390, height: 340 }
    })
  ).toMatchSnapshot('distance-measurement.png')

  await editor.page.keyboard.up('Alt')
  await expect
    .poll(() => editor.page.evaluate(() => window.openPencil?.getStore?.().state.measurementMode))
    .toBe('off')
})

test('deep measurement modifier targets a nested component child', async () => {
  const ids = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const pageId = store.state.currentPageId
    const selected = store.graph.createNode('RECTANGLE', pageId, {
      x: 100,
      y: 100,
      width: 50,
      height: 50
    })
    const component = store.graph.createNode('COMPONENT', pageId, {
      x: 250,
      y: 100,
      width: 200,
      height: 160,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    const child = store.graph.createNode('RECTANGLE', component.id, {
      x: 30,
      y: 30,
      width: 80,
      height: 60
    })
    store.select([selected.id])
    store.requestRender()
    return { componentId: component.id, childId: child.id }
  })
  await editor.canvas.waitForRender()
  await editor.canvas.hover(300, 150)

  await editor.page.keyboard.down('Alt')
  await expect
    .poll(() => editor.page.evaluate(() => window.openPencil?.getStore?.().state.hoveredNodeId))
    .toBe(ids.componentId)
  await editor.page.keyboard.down('Control')
  await expect
    .poll(() => editor.page.evaluate(() => window.openPencil?.getStore?.().state.hoveredNodeId))
    .toBe(ids.childId)

  await editor.page.keyboard.up('Control')
  await editor.page.keyboard.up('Alt')
})
