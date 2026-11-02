import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string): Promise<void> {
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(`${name}.png`)
}

test('canvas labels use shaped Inter text, ellipsis, and fixed-size zoom presentation', async () => {
  await editor.page.evaluate(() => {
    const store = window.lawha?.getStore?.()
    if (!store) throw new Error('Lawha store not initialized')
    const pageId = store.state.currentPageId
    store.graph.createNode('FRAME', pageId, {
      name: 'AVATAR To',
      x: 110,
      y: 130,
      width: 280,
      height: 110,
      fills: [{ type: 'SOLID', color: { r: 0.95, g: 0.97, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    const rotated = store.graph.createNode('FRAME', pageId, {
      name: 'Rotated Typography',
      x: 470,
      y: 140,
      width: 250,
      height: 100,
      rotation: 16,
      fills: [
        { type: 'SOLID', color: { r: 0.93, g: 0.95, b: 0.99, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    const section = store.graph.createNode('SECTION', pageId, {
      name: 'A very long section title that must ellipsize correctly',
      x: 100,
      y: 330,
      width: 300,
      height: 170,
      fills: [
        { type: 'SOLID', color: { r: 0.96, g: 0.78, b: 0.2, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    const set = store.graph.createNode('COMPONENT_SET', pageId, {
      name: 'Button collection',
      x: 470,
      y: 350,
      width: 280,
      height: 140,
      fills: [],
      strokes: []
    })
    store.graph.createNode('COMPONENT', set.id, {
      name: 'Primary AVATAR To',
      x: 24,
      y: 54,
      width: 190,
      height: 48,
      cornerRadius: 10,
      fills: [
        { type: 'SOLID', color: { r: 0.38, g: 0.2, b: 0.92, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    store.state.zoom = 1.25
    store.state.panX = 40
    store.state.panY = 20
    store.select([rotated.id])
    store.requestRender()
    void section
  })
  await expectCanvas('shaped-labels-zoom-125')

  await editor.page.evaluate(() => {
    const store = window.lawha?.getStore?.()
    if (!store) throw new Error('Lawha store not initialized')
    store.state.zoom = 2
    store.state.panX = -90
    store.state.panY = -180
    store.clearSelection()
    store.requestRender()
  })
  await expectCanvas('shaped-labels-zoom-200')
})
