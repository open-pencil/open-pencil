import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

// Figma desktop 126: in vector edit mode the region under the pointer is hatched with 45° lines,
// and so is a picked one.
test('vector edit mode hatches the hovered and the picked region', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const line = (start: number, end: number) => ({
      start,
      end,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })
    const vector = store.graph.createNode('VECTOR', store.state.currentPageId, {
      name: 'Two rooms',
      x: 100,
      y: 80,
      width: 260,
      height: 200,
      fills: [
        { type: 'SOLID', color: { r: 0.64, g: 0.74, b: 0.97, a: 1 }, opacity: 1, visible: true }
      ],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 130, y: 0 },
          { x: 260, y: 0 },
          { x: 260, y: 200 },
          { x: 130, y: 200 },
          { x: 0, y: 200 }
        ],
        segments: [
          line(0, 1),
          line(1, 4),
          line(4, 5),
          line(5, 0),
          line(1, 2),
          line(2, 3),
          line(3, 4)
        ],
        regions: [
          { windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] },
          { windingRule: 'NONZERO', loops: [[4, 5, 6, 1]] }
        ]
      }
    })
    store.enterNodeEditMode(vector.id)
  })
  await editor.canvas.waitForRender()
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds unavailable')

  // Pick the left room, then hover the right one.
  await editor.page.mouse.click(box.x + 165, box.y + 180)
  await editor.page.mouse.move(box.x + 295, box.y + 180)
  await editor.canvas.waitForRender()

  const regions = await editor.page.evaluate(() => {
    const edit = window.openPencil?.getStore?.().getNodeEditState?.()
    return { picked: [...(edit?.selectedRegions ?? [])], hovered: edit?.hoveredRegion ?? null }
  })
  expect(regions).toEqual({ picked: [0], hovered: 1 })
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('region-hatch.png')
})
