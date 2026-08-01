import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function dispatchMixedFileDrop() {
  return editor.page.getByTestId('canvas-element').evaluate(async (canvas) => {
    const bounds = canvas.getBoundingClientRect()
    const svg = new File(
      [
        '<svg width="40" height="20" viewBox="0 0 40 20"><rect width="20" height="20" fill="#f00"/><rect x="20" width="20" height="20" fill="#0c8"/></svg>'
      ],
      'mark.svg'
    )
    const rasterCanvas = document.createElement('canvas')
    rasterCanvas.width = 20
    rasterCanvas.height = 10
    const context = rasterCanvas.getContext('2d')
    if (!context) throw new Error('Canvas context unavailable')
    context.fillStyle = '#00f'
    context.fillRect(0, 0, 20, 10)
    const blob = await new Promise<Blob>((resolve, reject) => {
      rasterCanvas.toBlob((value) => {
        if (value) resolve(value)
        else reject(new Error('PNG failed'))
      })
    })
    const image = new File([blob], 'photo.png', { type: 'image/png' })
    const transfer = new DataTransfer()
    transfer.items.add(svg)
    transfer.items.add(image)
    const eventOptions = {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + 300,
      clientY: bounds.top + 200,
      dataTransfer: transfer
    }
    const dragoverAccepted = !canvas.dispatchEvent(new DragEvent('dragover', eventOptions))
    canvas.dispatchEvent(new DragEvent('drop', eventOptions))
    return dragoverAccepted
  })
}

test('mixed SVG and raster drops share placement, selection, and undo', async () => {
  expect(await dispatchMixedFileDrop()).toBe(true)

  await expect
    .poll(() =>
      editor.page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        return store?.graph.getChildren(store.state.currentPageId).length ?? 0
      })
    )
    .toBe(2)

  const placed = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return {
      nodes: store.graph
        .getChildren(store.state.currentPageId)
        .map((node) => ({ name: node.name, type: node.type })),
      selected: store.state.selectedIds.size,
      undoLabel: store.undo.undoLabel
    }
  })
  expect(placed).toEqual({
    nodes: [
      { name: 'mark', type: 'FRAME' },
      { name: 'photo', type: 'RECTANGLE' }
    ],
    selected: 2,
    undoLabel: 'Place files'
  })
  await editor.canvas.waitForRender()
  expect(await editor.canvas.canvas.screenshot()).toMatchSnapshot('dropped-svg-multicolor.png')

  await editor.page.evaluate(() => window.openPencil?.getStore?.().undoAction())
  await expect
    .poll(() =>
      editor.page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        return store?.graph.getChildren(store.state.currentPageId).length ?? 0
      })
    )
    .toBe(0)

  await editor.page.evaluate(() => window.openPencil?.getStore?.().redoAction())
  await expect
    .poll(() =>
      editor.page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        return store?.graph.getChildren(store.state.currentPageId).length ?? 0
      })
    )
    .toBe(2)
  editor.canvas.assertNoErrors()
})
