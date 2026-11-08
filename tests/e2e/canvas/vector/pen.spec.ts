import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

// Figma desktop 126: continuing a path, the point the pen draws from is solid, the segment to the
// cursor is blue, and a cursor within 4 pixels of a vertex's y snaps to it with a guide.
test('the pen previews a continued path and lines the next point up with its vertices', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const straight = { tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
    const vector = store.graph.createNode('VECTOR', store.state.currentPageId, {
      name: 'Open path',
      x: 100,
      y: 80,
      width: 200,
      height: 120,
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          align: 'CENTER',
          weight: 1
        }
      ],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 120 },
          { x: 100, y: 0 },
          { x: 200, y: 120 }
        ],
        segments: [
          { start: 0, end: 1, ...straight },
          { start: 1, end: 2, ...straight }
        ],
        regions: []
      }
    })
    store.enterNodeEditMode(vector.id)
    store.setTool('PEN')
  })
  await editor.canvas.waitForRender()
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds unavailable')

  await editor.page.mouse.click(box.x + 300, box.y + 200)
  await editor.page.mouse.move(box.x + 380, box.y + 83)
  await editor.canvas.waitForRender()

  const state = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    return {
      cursor: [store?.state.penCursorX, store?.state.penCursorY],
      guides: store?.state.snapGuides
    }
  })
  expect(state.cursor).toEqual([380, 80])
  expect(state.guides).toEqual([{ axis: 'y', position: 80, from: 200, to: 380, marks: [380, 200] }])
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('pen-continue-guide.png')
})

// Figma desktop 126: a press on the first point closes a path of two points; the closing segment
// leaves the last point along the handle dragged out of it, and arrives along the mirror of a drag
// at the first point, which points the way the path carries on.
test('the pen closes a two-point path along the last handle and the closing drag', async () => {
  await editor.page.evaluate(() => window.openPencil?.getStore?.()?.setTool('PEN'))
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds unavailable')
  const mouse = editor.page.mouse

  await mouse.click(box.x + 100, box.y + 100)
  await mouse.move(box.x + 300, box.y + 100)
  await mouse.down()
  await mouse.move(box.x + 300, box.y + 160, { steps: 6 })
  await mouse.up()
  await mouse.move(box.x + 100, box.y + 100)
  await mouse.down()
  await mouse.move(box.x + 100, box.y + 40, { steps: 6 })
  await mouse.up()
  await editor.canvas.waitForRender()

  const path = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const [id] = store?.state.selectedIds ?? []
    const network = id ? store?.graph.getNode(id)?.vectorNetwork : undefined
    return {
      tool: store?.state.activeTool,
      // Mirrored zero handles are -0; the path is the same.
      segments: network?.segments.map((s) =>
        [s.start, s.end, s.tangentStart.x, s.tangentStart.y, s.tangentEnd.x, s.tangentEnd.y].map(
          (n) => n + 0
        )
      ),
      regions: network?.regions.length
    }
  })
  expect(path).toEqual({
    tool: 'SELECT',
    segments: [
      [0, 1, 0, 0, 0, -60],
      [1, 0, 0, 60, 0, 60]
    ],
    regions: 1
  })
  editor.canvas.assertNoErrors()
})

// A drag that comes back to its point leaves no handle, as one that never left; only a press that
// never passed the drag threshold counts as a click.
test('the pen drags a handle back to nothing', async () => {
  await editor.page.evaluate(() => window.openPencil?.getStore?.()?.setTool('PEN'))
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds unavailable')
  const mouse = editor.page.mouse

  await mouse.click(box.x + 100, box.y + 100)
  await mouse.move(box.x + 300, box.y + 100)
  await mouse.down()
  await mouse.move(box.x + 360, box.y + 100, { steps: 6 })
  await mouse.move(box.x + 300, box.y + 100, { steps: 6 })
  await mouse.up()

  const handles = await editor.page.evaluate(() => {
    const pen = window.openPencil?.getStore?.()?.state.penState
    const segment = pen?.segments[0]
    return {
      out: pen?.dragTangent ? Math.hypot(pen.dragTangent.x, pen.dragTangent.y) : null,
      into: segment ? Math.hypot(segment.tangentEnd.x, segment.tangentEnd.y) : null
    }
  })
  expect(handles).toEqual({ out: 0, into: 0 })
})

// A press that lands beside the first point snaps to it; a pixel of movement after it is still a
// click, so the closing segment comes in straight.
test('the pen closes with a click pressed beside the first point', async () => {
  await editor.page.evaluate(() => window.openPencil?.getStore?.()?.setTool('PEN'))
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds unavailable')
  const mouse = editor.page.mouse

  await mouse.click(box.x + 100, box.y + 100)
  await mouse.click(box.x + 300, box.y + 100)
  await mouse.move(box.x + 105, box.y + 100)
  await mouse.down()
  await mouse.move(box.x + 106, box.y + 100)
  await mouse.up()

  const closing = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const [id] = store?.state.selectedIds ?? []
    const segment = id ? store?.graph.getNode(id)?.vectorNetwork?.segments.at(-1) : undefined
    return (
      segment && { end: segment.end, into: Math.hypot(segment.tangentEnd.x, segment.tangentEnd.y) }
    )
  })
  expect(closing).toEqual({ end: 0, into: 0 })
})

// Figma desktop 126: a press back on the last point, the start included, keeps the point and the
// handle into it, and its drag sets the outgoing handle again.
test('the pen drags the last point out again when it is pressed', async () => {
  await editor.page.evaluate(() => window.openPencil?.getStore?.()?.setTool('PEN'))
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds unavailable')
  const mouse = editor.page.mouse
  const drag = async (x: number, y: number, dx: number, dy: number) => {
    await mouse.move(box.x + x, box.y + y)
    await mouse.down()
    await mouse.move(box.x + x + dx, box.y + y + dy, { steps: 6 })
    await mouse.up()
  }

  await drag(100, 100, 60, 0)
  await drag(100, 100, 0, 60)
  await drag(300, 100, 60, 0)
  await drag(300, 100, 0, 60)
  await mouse.click(box.x + 300, box.y + 300)

  const pen = await editor.page.evaluate(() => {
    const state = window.openPencil?.getStore?.()?.state.penState
    return {
      points: state?.vertices.length,
      // Mirrored zero handles are -0; the path is the same.
      segments: state?.segments.map((s) =>
        [s.tangentStart.x, s.tangentStart.y, s.tangentEnd.x, s.tangentEnd.y].map((n) => n + 0)
      )
    }
  })
  expect(pen).toEqual({
    points: 3,
    segments: [
      [0, 60, -60, 0],
      [0, 60, 0, 0]
    ]
  })
})

// Figma desktop 126: each pen point is an undo step, and undo after the path ends draws on again.
test('undo takes back pen points one by one, also after the path ends', async () => {
  await editor.page.evaluate(() => window.openPencil?.getStore?.()?.setTool('PEN'))
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds unavailable')
  const { mouse, keyboard } = editor.page
  const read = () =>
    editor.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      return {
        points: store?.state.penState?.vertices.length ?? 0,
        tool: store?.state.activeTool,
        layers: store?.graph.getChildren(store.state.currentPageId).length
      }
    })

  await mouse.click(box.x + 100, box.y + 100)
  await mouse.click(box.x + 300, box.y + 100)
  await mouse.click(box.x + 300, box.y + 300)
  await keyboard.press('ControlOrMeta+z')
  expect(await read()).toEqual({ points: 2, tool: 'PEN', layers: 0 })
  await keyboard.press('ControlOrMeta+Shift+z')
  expect(await read()).toEqual({ points: 3, tool: 'PEN', layers: 0 })

  await keyboard.press('Escape')
  expect(await read()).toEqual({ points: 0, tool: 'SELECT', layers: 1 })
  await keyboard.press('ControlOrMeta+z')
  expect(await read()).toEqual({ points: 3, tool: 'PEN', layers: 0 })
  await keyboard.press('ControlOrMeta+z')
  expect(await read()).toEqual({ points: 2, tool: 'PEN', layers: 0 })
  await mouse.click(box.x + 100, box.y + 300)
  expect(await read()).toEqual({ points: 3, tool: 'PEN', layers: 0 })
})
