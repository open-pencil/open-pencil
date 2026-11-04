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
            type: 'SOLID',
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
            type: 'SOLID',
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

test('vector path corners take the stroke join', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const zero = { x: 0, y: 0 }
    const line = (start: number, end: number) => ({
      start,
      end,
      tangentStart: zero,
      tangentEnd: zero
    })
    const stroke = (join: 'MITER' | 'BEVEL' | 'ROUND') => [
      {
        type: 'SOLID' as const,
        color: { r: 0.23, g: 0.51, b: 0.96, a: 1 },
        weight: 16,
        visible: true,
        opacity: 1,
        align: 'CENTER' as const,
        join
      }
    ]
    // An open zigzag, unfilled, once per join.
    const joins = ['MITER', 'BEVEL', 'ROUND'] as const
    for (const [index, join] of joins.entries()) {
      store.graph.createNode('VECTOR', pageId, {
        name: `${join} polyline join visual`,
        x: 72 + index * 190,
        y: 80,
        width: 140,
        height: 90,
        vectorNetwork: {
          vertices: [
            { x: 0, y: 90 },
            { x: 45, y: 0 },
            { x: 90, y: 90 },
            { x: 140, y: 20 }
          ],
          segments: [line(0, 1), line(1, 2), line(2, 3)],
          regions: []
        },
        strokeJoin: join,
        strokeMiterLimit: 4,
        fills: [],
        strokes: stroke(join)
      })
    }
    // A closed loop with no region: its first corner joins like the others.
    store.graph.createNode('VECTOR', pageId, {
      name: 'closed loop join visual',
      x: 120,
      y: 230,
      width: 120,
      height: 100,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 120, y: 30 },
          { x: 40, y: 100 }
        ],
        segments: [line(0, 1), line(1, 2), line(2, 0)],
        regions: []
      },
      strokeJoin: 'MITER',
      strokeMiterLimit: 4,
      fills: [],
      strokes: stroke('MITER')
    })
    // A loop with a tail from its first corner, stored starting from the next corner.
    store.graph.createNode('VECTOR', pageId, {
      name: 'loop with tail join visual',
      x: 340,
      y: 230,
      width: 180,
      height: 100,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
          { x: 180, y: 50 }
        ],
        segments: [line(1, 2), line(2, 3), line(3, 0), line(0, 1), line(0, 4)],
        regions: []
      },
      strokeJoin: 'MITER',
      strokeMiterLimit: 4,
      fills: [],
      strokes: stroke('MITER')
    })

    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot('vector-path-joins.png')
})
