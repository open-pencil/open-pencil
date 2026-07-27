import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('text case vertical alignment and ending truncation', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const cases = [
      { label: 'uppercase text', textCase: 'UPPER' as const, vertical: 'TOP' as const },
      { label: 'centered Title', textCase: 'TITLE' as const, vertical: 'CENTER' as const },
      { label: 'bottom text', textCase: 'LOWER' as const, vertical: 'BOTTOM' as const }
    ]
    for (const [index, item] of cases.entries()) {
      const x = 70 + index * 240
      store.graph.createNode('RECTANGLE', pageId, {
        x,
        y: 90,
        width: 200,
        height: 130,
        fills: [
          {
            type: 'SOLID',
            color: { r: 0.92, g: 0.94, b: 0.98, a: 1 },
            opacity: 1,
            visible: true
          }
        ]
      })
      store.graph.createNode('TEXT', pageId, {
        x: x + 12,
        y: 102,
        width: 176,
        height: 106,
        text: item.label,
        fontSize: 20,
        lineHeight: 36,
        textCase: item.textCase,
        textAlignVertical: item.vertical
      })
    }

    store.graph.createNode('RECTANGLE', pageId, {
      x: 70,
      y: 270,
      width: 300,
      height: 80,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.98, g: 0.91, b: 0.82, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })
    store.graph.createNode('TEXT', pageId, {
      x: 82,
      y: 280,
      width: 276,
      height: 60,
      text: 'This paragraph demonstrates a deterministic two-line ending truncation with an ellipsis.',
      fontSize: 17,
      lineHeight: 22,
      textTruncation: 'ENDING',
      maxLines: 2,
      textAlignHorizontal: 'JUSTIFIED'
    })

    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await editor.page.waitForTimeout(300)
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.canvas.screenshot()).toMatchSnapshot('typography-depth.png')
})
