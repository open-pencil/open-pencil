import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.canvas.screenshot()
  expect(buffer).toMatchSnapshot(`${name}.png`)
}

test('multi-color vector path fills', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId

    // [cmd u8][x f32][y f32]… path commands blob for an axis-aligned rectangle
    const rectBlob = (x: number, y: number, w: number, h: number) => {
      const blob = new Uint8Array(1 + 4 * 9 + 1)
      const view = new DataView(blob.buffer)
      const points = [
        { command: 1, x, y },
        { command: 2, x: x + w, y },
        { command: 2, x: x + w, y: y + h },
        { command: 2, x, y: y + h }
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

    const purple = {
      type: 'SOLID' as const,
      color: { r: 0.3, g: 0.06, b: 0.52, a: 1 },
      visible: true,
      opacity: 1
    }
    const orange = {
      type: 'SOLID' as const,
      color: { r: 1, g: 0.4, b: 0, a: 1 },
      visible: true,
      opacity: 1
    }

    const multiColorFillGeometry = () => [
      // Left half uses the node fill (purple), right half overrides to orange —
      // the FedEx wordmark pattern from styleOverrideTable imports.
      { windingRule: 'NONZERO' as const, commandsBlob: rectBlob(0, 0, 90, 60) },
      {
        windingRule: 'NONZERO' as const,
        commandsBlob: rectBlob(90, 0, 90, 60),
        styleID: 1,
        fills: [orange]
      }
    ]

    store.graph.createNode('VECTOR', pageId, {
      name: 'Multi-color flat',
      x: 72,
      y: 80,
      width: 180,
      height: 60,
      fills: [purple],
      fillGeometry: multiColorFillGeometry()
    })

    // Same vector nested in a rotated frame — per-path fills must follow the
    // node through its full world transform.
    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Rotated host',
      x: 380,
      y: 60,
      width: 260,
      height: 140,
      rotation: 20,
      fills: [
        { type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.97, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    store.graph.createNode('VECTOR', frame.id, {
      name: 'Multi-color nested',
      x: 40,
      y: 40,
      width: 180,
      height: 60,
      rotation: 10,
      fills: [purple],
      fillGeometry: multiColorFillGeometry()
    })

    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await expectCanvas('multi-color-vector-path-fills')
})

test('vector edit mode overlay on a nested rotated vector', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId

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
      fills: [
        { type: 'SOLID', color: { r: 0.23, g: 0.51, b: 0.96, a: 1 }, visible: true, opacity: 1 }
      ],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 100 },
          { x: 0, y: 100 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 40, y: 20 }, tangentEnd: { x: -40, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 3, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
      }
    })

    store.enterNodeEditMode(vector.id)
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await expectCanvas('vector-edit-mode-overlay')
})
