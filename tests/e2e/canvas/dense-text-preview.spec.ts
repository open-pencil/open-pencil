import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { probeParagraphBuilds } from '#tests/helpers/canvas/text-preparation'

const editor = useEditorSetupWithClear('/?test&no-rulers&navigation-benchmark')

test('dense text keeps exact pixels without reshaping unchanged labels during previews', async () => {
  const interaction = await editor.page.evaluateHandle(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    return store.beginInteractiveEdit()
  })
  try {
    const previewId = await editor.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const page = store.state.currentPageId
      const group = store.graph.createNode('FRAME', page, {
        name: 'Dense text',
        width: 8000,
        height: 3600,
        fills: []
      })
      // Coverage and drawing formerly needed 1,200 entries in a 1,024-paragraph cache.
      for (let i = 0; i < 600; i++) {
        store.graph.createNode('TEXT', group.id, {
          x: (i % 20) * 400,
          y: Math.floor(i / 20) * 120,
          width: 380,
          height: 110,
          fontFamily: 'Inter',
          fontWeight: 400,
          fontSize: 48,
          text: `Label ${i}`,
          fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
        })
      }
      const marker = store.graph.createNode('RECTANGLE', page, {
        x: -10000,
        y: -10000,
        width: 10,
        height: 10
      })
      store.clearSelection()
      store.setZoomAroundPoint(0.06, 0, 0)
      store.pan(-store.state.panX, -store.state.panY)
      store.requestRender()
      return marker.id
    })
    await editor.page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
    await editor.page.evaluate((id) => {
      const store = window.openPencil?.getStore?.()
      if (!store?.renderer) throw new Error('Renderer unavailable')
      store.renderer.textPreparationCache.clear()
      store.graph.updateNodePreview(id, { x: -10004 })
      store.requestRepaint()
    }, previewId)
    await editor.canvas.waitForRender()
    const reference = await editor.canvas.screenshotCanvasRegion(520, 240)
    expect(reference).toMatchSnapshot('dense-text-preview.png', { threshold: 0, maxDiffPixels: 0 })

    // One additional pass lets drawing paragraphs occupy the cache after coverage
    // observations have been memoized. Subsequent preview frames must not shape text.
    await editor.page.evaluate((id) => {
      const store = window.openPencil?.getStore?.()
      store?.graph.updateNodePreview(id, { x: -10003 })
      store?.requestRepaint()
    }, previewId)
    await editor.canvas.waitForRender()
    const probe = await probeParagraphBuilds(editor.page)
    try {
      for (const x of [-10002, -10001, -10000]) {
        await editor.page.evaluate(
          ({ id, x }) => {
            const store = window.openPencil?.getStore?.()
            store?.graph.updateNodePreview(id, { x })
            store?.requestRepaint()
          },
          { id: previewId, x }
        )
        await editor.canvas.waitForRender()
      }
      expect(await probe.evaluate((probe) => probe.readiness())).toBeGreaterThanOrEqual(1800)
      expect(await probe.evaluate((probe) => probe.count())).toBe(0)
      const actual = await editor.canvas.screenshotCanvasRegion(520, 240)
      expect(actual.equals(reference)).toBe(true)
      editor.canvas.assertNoErrors()
    } finally {
      try {
        await probe.evaluate((probe) => probe.restore())
      } finally {
        await probe.dispose()
      }
    }
  } finally {
    try {
      await interaction.evaluate((end) => end())
    } finally {
      await interaction.dispose()
    }
  }
})
