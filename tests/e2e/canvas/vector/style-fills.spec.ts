import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('vector paths render their resolved style fills', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const rectangleBlob = (x: number, y: number, width: number, height: number) => {
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
      return blob
    }

    const source = store.graph.createNode('VECTOR', store.state.currentPageId, {
      name: 'Multi-color vector',
      x: 180,
      y: 110,
      width: 440,
      height: 140,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.3, g: 0.06, b: 0.52, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      fillGeometry: [
        { windingRule: 'NONZERO', commandsBlob: rectangleBlob(0, 0, 260, 140) },
        {
          windingRule: 'NONZERO',
          commandsBlob: rectangleBlob(260, 0, 180, 140),
          fills: [
            {
              type: 'SOLID',
              color: { r: 1, g: 0.32, b: 0, a: 1 },
              opacity: 1,
              visible: true
            }
          ]
        }
      ]
    })

    store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      name: 'Multi-color vector pattern',
      x: 180,
      y: 330,
      width: 440,
      height: 140,
      fills: [
        {
          type: 'PATTERN',
          sourceNodeId: source.id,
          patternTileType: 'RECTANGULAR',
          scale: 0.5,
          color: { r: 1, g: 1, b: 1, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })

    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.canvas.screenshot()).toMatchSnapshot('vector-path-style-fills.png')
})
