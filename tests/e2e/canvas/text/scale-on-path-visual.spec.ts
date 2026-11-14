import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('scales text on a curved path along its path, and undo puts it back', async () => {
  const placed = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    const box = { x: 20, y: 20, width: 200, height: 80 }
    const node = store.graph.createNode('TEXT', store.state.currentPageId, {
      ...box,
      text: 'Arc',
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      fontSize: 20,
      textAutoResize: 'NONE',
      textPathBox: { x: 0, y: 0, width: box.width, height: box.height },
      derivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 10, y: 70, fontSize: 20, rotation: -0.6 },
        { commandsBlob: new Uint8Array(4), x: 24, y: 60, fontSize: 20, rotation: -0.5 }
      ]
    })
    node.textPathData = {
      network: {
        vertices: [
          { x: 0, y: 80 },
          { x: 200, y: 80 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 60, y: -100 }, tangentEnd: { x: -60, y: -100 } }
        ],
        regions: []
      },
      normalizedSize: { x: 200, y: 80 },
      tValue: 0,
      forward: true
    }
    store.updateNode(node.id, { text: 'Text along a curve' })
    store.select([node.id])
    store.requestRender()
    return { id: node.id, glyphs: store.graph.getNode(node.id)?.derivedTextGlyphs?.length ?? 0 }
  })
  expect(placed.glyphs).toBeGreaterThan(2)

  const scaled = await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    store.scaleSelected(2, { x: 20, y: 20 })
    store.clearSelection()
    store.requestRender()
    const node = store.graph.getNode(id)
    return { fontSize: node?.fontSize, onPath: node?.textPathData !== null }
  }, placed.id)
  expect(scaled).toEqual({ fontSize: 40, onPath: true })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(460, 220)).toMatchSnapshot(
    'text-path-scaled.png'
  )

  const restored = await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    store.undoAction()
    store.clearSelection()
    store.requestRender()
    const node = store.graph.getNode(id)
    return { fontSize: node?.fontSize, onPath: node?.textPathData !== null }
  }, placed.id)
  expect(restored).toEqual({ fontSize: 20, onPath: true })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(460, 220)).toMatchSnapshot(
    'text-path-scale-undone.png'
  )
})
