import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('vector edit overlay follows nested transforms and live path fills', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const rectBlob = (x: number, y: number, width: number, height: number) => {
      const blob = new Uint8Array(38)
      const view = new DataView(blob.buffer)
      const points = [
        { command: 1, x, y },
        { command: 2, x: x + width, y },
        { command: 2, x: x + width, y: y + height },
        { command: 2, x, y: y + height }
      ]
      let offset = 0
      for (const point of points) {
        blob[offset] = point.command
        view.setFloat32(offset + 1, point.x, true)
        view.setFloat32(offset + 5, point.y, true)
        offset += 9
      }
      blob[offset] = 0
      return blob
    }

    const blue = {
      type: 'SOLID' as const,
      color: { r: 0.23, g: 0.51, b: 0.96, a: 1 },
      visible: true,
      opacity: 1
    }
    const orange = {
      type: 'SOLID' as const,
      color: { r: 1, g: 0.4, b: 0, a: 1 },
      visible: true,
      opacity: 1
    }
    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Edit host',
      x: 220,
      y: 120,
      width: 400,
      height: 300,
      rotation: 30,
      fills: [
        { type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.97, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    const vector = store.graph.createNode('VECTOR', frame.id, {
      name: 'Edited vector',
      x: 60,
      y: 80,
      width: 200,
      height: 100,
      rotation: 20,
      fills: [blue],
      fillGeometry: [
        { windingRule: 'NONZERO', commandsBlob: rectBlob(0, 0, 100, 100) },
        { windingRule: 'NONZERO', commandsBlob: rectBlob(100, 0, 100, 100), fills: [orange] }
      ],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
          { x: 100, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 100 },
          { x: 100, y: 100 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 20, y: 20 }, tangentEnd: { x: -20, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 3, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 4, end: 5, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 5, end: 6, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 6, end: 7, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 7, end: 4, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: [
          { windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] },
          { windingRule: 'NONZERO', loops: [[4, 5, 6, 7]] }
        ]
      }
    })

    store.enterNodeEditMode(vector.id)
    const editState = store.getNodeEditState()
    if (editState) editState.vertices[6].x += 30
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot('vector-edit-mode-overlay.png')
})

test('a Pen-created Bézier commits a vertex drag on mouseup', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.exitNodeEditMode(true)
    store.setTool('PEN')
  })
  await editor.canvas.waitForRender()
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds unavailable')

  await editor.page.mouse.click(box.x + 180, box.y + 180)
  await editor.page.mouse.move(box.x + 240, box.y + 140)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + 280, box.y + 120, { steps: 4 })
  await editor.page.mouse.up()

  await editor.page.mouse.move(box.x + 420, box.y + 320)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + 460, box.y + 360, { steps: 4 })
  await editor.page.mouse.up()
  const penBeforeCommit = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    return { tool: store?.state.activeTool, vertices: store?.state.penState?.vertices.length ?? 0 }
  })
  expect(penBeforeCommit.tool).toBe('PEN')
  expect(penBeforeCommit.vertices).toBeGreaterThanOrEqual(2)
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.penCommit(false)
  })
  await editor.canvas.waitForRender()

  const vectorId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const page = store.graph.getNode(store.state.currentPageId)
    const vector = page?.childIds
      .map((id: string) => store.graph.getNode(id))
      .find((node) => node?.type === 'VECTOR')
    if (!vector) throw new Error('Pen did not create a vector')
    return vector.id
  })

  await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.enterNodeEditMode(id)
  }, vectorId)
  await editor.canvas.waitForRender()

  const vertex = await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    const node = store?.graph.getNode(id)
    const edit = store?.getNodeEditState?.()
    if (!node || node.type !== 'VECTOR' || !edit) throw new Error('Vector edit state unavailable')
    const point = edit.vertices[0]
    return { x: point.x, y: point.y, before: node.vectorNetwork?.vertices[0] ?? null }
  }, vectorId)
  await editor.page.mouse.move(box.x + vertex.x, box.y + vertex.y)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + vertex.x + 35, box.y + vertex.y + 20, { steps: 5 })
  await editor.page.mouse.up()

  const result = await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    const edit = store?.getNodeEditState?.()
    const node = store?.graph.getNode(id)
    return {
      editMode: edit !== null && edit !== undefined,
      editVertex: edit?.vertices[0] ?? null,
      graphVertex: node?.type === 'VECTOR' ? (node.vectorNetwork?.vertices[0] ?? null) : null
    }
  }, vectorId)
  expect(result.editMode).toBe(true)
  expect(result.editVertex).not.toEqual(vertex.before)
  expect(result.graphVertex).not.toEqual(vertex.before)
})
test('dragging a vector point snaps to sibling bounds and clears guides on release', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const vector = store.graph.createNode('VECTOR', pageId, {
      name: 'Snap source',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: []
      }
    })
    store.graph.createNode('RECTANGLE', pageId, {
      name: 'Snap target',
      x: 300,
      y: 80,
      width: 100,
      height: 140
    })
    store.enterNodeEditMode(vector.id)
  })
  await editor.canvas.waitForRender()

  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds unavailable')
  await editor.page.mouse.move(box.x + 100, box.y + 100)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + 297, box.y + 100, { steps: 12 })

  const duringDrag = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const editState = store?.getNodeEditState()
    return {
      vertex: editState?.vertices[0],
      guides: store?.state.snapGuides ?? []
    }
  })
  expect(duringDrag.vertex).toMatchObject({ x: 300, y: 100 })
  expect(duringDrag.guides).toContainEqual({ axis: 'x', position: 300, from: 80, to: 220 })

  await editor.page.mouse.up()
  await expect
    .poll(() =>
      editor.page.evaluate(() => window.openPencil?.getStore?.().state.snapGuides.length ?? -1)
    )
    .toBe(0)
  const committed = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const editState = store?.getNodeEditState()
    const nodeId = editState?.nodeId
    const node = nodeId ? store?.graph.getNode(nodeId) : null
    return {
      editMode: editState !== null && editState !== undefined,
      vertex: editState?.vertices[0] ?? null,
      graphVertex: node?.type === 'VECTOR' ? (node.vectorNetwork?.vertices[0] ?? null) : null,
      guides: store?.state.snapGuides ?? []
    }
  })
  expect(committed.editMode).toBe(true)
  expect(committed.vertex).toMatchObject({ x: 300, y: 100 })
  expect(committed.graphVertex).not.toBeNull()
  expect(committed.guides).toEqual([])
  const committedVertex = committed.vertex
  await editor.page.mouse.move(box.x + 420, box.y + 260, { steps: 5 })
  expect(
    await editor.page.evaluate(
      () => window.openPencil?.getStore?.()?.getNodeEditState()?.vertices[0] ?? null
    )
  ).toEqual(committedVertex)

  await editor.page.mouse.move(box.x + 300, box.y + 100)
  await editor.page.mouse.down()
  await editor.page.keyboard.down('Control')
  await editor.page.mouse.move(box.x + 297, box.y + 100, { steps: 3 })
  const withControl = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    return {
      vertex: store?.getNodeEditState()?.vertices[0],
      guides: store?.state.snapGuides ?? []
    }
  })
  expect(withControl.vertex).toMatchObject({ x: 297, y: 100 })
  expect(withControl.guides).toEqual([])
  await editor.page.keyboard.up('Control')
  await editor.page.mouse.up()

  editor.canvas.assertNoErrors()
})
