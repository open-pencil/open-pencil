import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('stroke caps joins and miter limits', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const color = { r: 0.23, g: 0.51, b: 0.96, a: 1 }
    const caps = ['NONE', 'ROUND', 'SQUARE'] as const
    for (const [index, cap] of caps.entries()) {
      store.graph.createNode('VECTOR', pageId, {
        name: `${cap} cap visual`,
        x: 92 + index * 190,
        y: 72,
        width: 120,
        height: 41,
        vectorNetwork: {
          vertices: [
            { x: 0, y: 0 },
            { x: 120, y: 40 }
          ],
          segments: [
            { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
          ],
          regions: []
        },
        strokeCap: cap,
        strokes: [
          {
            color,
            weight: 20,
            visible: true,
            opacity: 1,
            align: 'CENTER',
            cap
          }
        ]
      })
    }

    const joins = [
      { join: 'MITER' as const, limit: 1 },
      { join: 'MITER' as const, limit: 12 },
      { join: 'BEVEL' as const, limit: 4 },
      { join: 'ROUND' as const, limit: 4 }
    ]
    for (const [index, { join, limit }] of joins.entries()) {
      store.graph.createNode('STAR', pageId, {
        name: `${join} ${limit} join visual`,
        x: 72 + index * 150,
        y: 170,
        width: 110,
        height: 110,
        pointCount: 5,
        starInnerRadius: 0.18,
        strokeJoin: join,
        strokeMiterLimit: limit,
        strokes: [
          {
            color: { r: 0.96, g: 0.35, b: 0.12, a: 1 },
            weight: 10,
            visible: true,
            opacity: 1,
            align: 'CENTER',
            join
          }
        ]
      })
    }

    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot('stroke-caps-joins-miter-limits.png')
})
