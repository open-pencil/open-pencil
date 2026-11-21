import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

// Figma's snapping while a move changes frames: an icon on the page dragged over a frame snaps to
// the layers in that frame, where the drop puts it.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

/** A 400×300 frame holding an 80×80 card at (40, 40), and a 24×24 icon frame on the page beside it. */
async function frameAndIcon() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    store.state.snappingPreferences = { geometry: true, objects: true, pixelGrid: false }
    const frame = store.createShape('FRAME', 100, 100, 400, 300)
    store.createShape('RECTANGLE', 40, 40, 80, 80, frame)
    const icon = store.createShape('FRAME', 600, 100, 24, 24)
    store.createShape('RECTANGLE', 2, 2, 20, 20, icon)
    store.select([icon])
    return { frame, icon }
  })
}

function layer(id: string) {
  return editor.page.evaluate((id) => {
    const node = window.openPencil?.getStore?.().graph.getNode(id)
    if (!node) throw new Error(`Layer ${id} not found`)
    return { x: node.x, y: node.y, parentId: node.parentId }
  }, id)
}

test('an icon dragged over a frame snaps to the layers in that frame', async () => {
  const { frame, icon } = await frameAndIcon()
  await editor.canvas.waitForRender()

  // The icon's left edge lands 1px right of the card's, at x 141, below the card.
  const box = await editor.page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('No canvas')
  await editor.page.mouse.move(box.x + 612, box.y + 112)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + 153, box.y + 262, { steps: 15 })

  const guides = await editor.page.evaluate(
    () => window.openPencil?.getStore?.().state.snapGuides ?? []
  )
  expect(guides).toContainEqual(expect.objectContaining({ axis: 'x', position: 140 }))

  await editor.page.mouse.up()
  await expect.poll(() => layer(icon)).toEqual({ x: 40, y: 150, parentId: frame })
  editor.canvas.assertNoErrors()
})
