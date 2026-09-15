import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { probeParagraphBuilds } from '#tests/helpers/canvas/text-preparation'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('text case vertical alignment and ending truncation', async () => {
  const previewId = await editor.page.evaluate(() => {
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

    const preview = store.graph.createNode('RECTANGLE', pageId, { x: -10000, width: 1, height: 1 })
    store.clearSelection()
    store.requestRender()
    return preview.id
  })
  await editor.canvas.waitForRender()
  await editor.page.waitForTimeout(300)
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('typography-depth.png')

  // Compare cold and warm text on the same direct-render path, not retained vs direct rasterization.
  await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store?.renderer) throw new Error('Renderer unavailable')
    store.renderer.textPreparationCache.clear()
    store.graph.updateNodePreview(id, { x: -10004 })
    store.requestRepaint()
  }, previewId)
  await editor.canvas.waitForRender()
  const reference = await editor.canvas.screenshotCanvasRegion()
  const preparations = await probeParagraphBuilds(editor.page)
  try {
    for (let step = 0; step < 3; step++) {
      await editor.page.evaluate(
        ({ id, x }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('Editor unavailable')
          store.graph.updateNodePreview(id, { x })
          store.requestRepaint()
        },
        { id: previewId, x: -10001 - step }
      )
      await editor.canvas.waitForRender()
    }
    const actual = await editor.canvas.screenshotCanvasRegion()
    if (!actual.equals(reference)) {
      await test.info().attach('cold-text', { body: reference, contentType: 'image/png' })
      await test.info().attach('warm-text', { body: actual, contentType: 'image/png' })
    }
    expect(actual.equals(reference)).toBe(true)
    expect(await preparations.evaluate((probe) => probe.count())).toBe(0)
  } finally {
    try {
      await preparations.evaluate((probe) => probe.restore())
    } finally {
      await preparations.dispose()
    }
  }
})
