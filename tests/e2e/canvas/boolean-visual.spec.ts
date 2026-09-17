import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
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
