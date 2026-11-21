import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

// Figma's Alt resize: holding Alt while dragging a handle grows the layer around its center.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function selectedRect() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    store.state.snappingPreferences = { geometry: true, objects: true, pixelGrid: true }
    const rect = store.createShape('RECTANGLE', 200, 200, 200, 100)
    store.select([rect])
    return rect
  })
}

function box(id: string) {
  return editor.page.evaluate((id) => {
    const node = window.openPencil?.getStore?.().graph.getNode(id)
    if (!node) throw new Error(`Layer ${id} not found`)
    return { x: node.x, y: node.y, width: node.width, height: node.height }
  }, id)
}

test('Alt while dragging a side handle resizes from the center', async () => {
  const rect = await selectedRect()
  await editor.canvas.waitForRender()

  await editor.canvas.dragWith('Alt', 400, 250, 440, 250)

  await expect.poll(() => box(rect)).toEqual({ x: 160, y: 200, width: 280, height: 100 })
  editor.canvas.assertNoErrors()
})

test('Alt and Shift on a corner keep the center and the proportions', async () => {
  const rect = await selectedRect()
  await editor.canvas.waitForRender()

  await editor.page.keyboard.down('Shift')
  await editor.canvas.dragWith('Alt', 400, 300, 440, 320)
  await editor.page.keyboard.up('Shift')

  await expect.poll(() => box(rect)).toEqual({ x: 160, y: 180, width: 280, height: 140 })
  editor.canvas.assertNoErrors()
})
