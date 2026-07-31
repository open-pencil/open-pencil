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
  const buffer = await editor.canvas.canvas.screenshot()
  expect(buffer).toMatchSnapshot('vector-edit-mode-overlay.png')
})
