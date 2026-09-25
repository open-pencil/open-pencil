import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('fixed stretched labels retain their full height in HUG rows', async () => {
  const heights = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const labels = []
    for (const [index, tier] of ['Silver', 'Gold', 'Platinum'].entries()) {
      const card = store.graph.createNode('FRAME', store.state.currentPageId, {
        name: `${tier} card`,
        x: 48,
        y: 48 + index * 88,
        width: 380,
        height: 64,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
      })
      const row = store.graph.createNode('FRAME', card.id, {
        name: 'Classification label',
        x: 24,
        y: 24,
        width: 332,
        height: 16,
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'HUG',
        counterAxisAlign: 'CENTER',
        itemSpacing: 8
      })
      store.graph.createNode('ELLIPSE', row.id, {
        width: 10,
        height: 10,
        fills: [
          { type: 'SOLID', color: { r: 0.45, g: 0.55, b: 0.65, a: 1 }, opacity: 1, visible: true }
        ]
      })
      const text = store.graph.createNode('TEXT', row.id, {
        text: `CLASSIFICAÇÃO ${tier.toUpperCase()}`,
        width: 314,
        height: 16,
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 16,
        textAutoResize: 'NONE',
        layoutGrow: 1,
        layoutAlignSelf: 'STRETCH',
        fills: [
          { type: 'SOLID', color: { r: 0.1, g: 0.12, b: 0.15, a: 1 }, opacity: 1, visible: true }
        ]
      })
      store.runLayoutForNode(row.id)
      labels.push(text)
    }
    await store.loadFontsForNodes(labels.map((node) => node.id))
    store.clearSelection()
    store.requestRender()
    return labels.map((node) => node.height)
  })
  expect(heights).toEqual([16, 16, 16])
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(480, 320)).toMatchSnapshot(
    'fixed-stretch-labels.png'
  )
})
