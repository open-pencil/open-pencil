import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

// Figma's press inside a selected top-level frame, such as an inserted icon: a drag moves the
// frame with what it holds, and a click without a drag selects the layer under the press.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

/** A top-level 48×48 frame holding one 40×40 layer, like an icon and its path, with the frame selected. */
async function selectedIcon() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const frame = store.createShape('FRAME', 200, 200, 48, 48)
    const path = store.createShape('RECTANGLE', 0, 8, 40, 40, frame)
    store.select([frame])
    return { frame, path }
  })
}

function layer(id: string) {
  return editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    const node = store?.graph.getNode(id)
    if (!store || !node) throw new Error(`Layer ${id} not found`)
    return { x: node.x, y: node.y, parentId: node.parentId, selected: [...store.state.selectedIds] }
  }, id)
}

test('dragging a selected top-level frame from a layer inside it moves the frame', async () => {
  const { frame, path } = await selectedIcon()
  await editor.canvas.waitForRender()

  await editor.canvas.drag(220, 230, 280, 270)

  await expect.poll(async () => (await layer(frame)).x).toBe(260)
  expect(await layer(frame)).toMatchObject({ y: 240, selected: [frame] })
  expect(await layer(path)).toMatchObject({ x: 0, y: 8, parentId: frame })
  expect(
    await editor.page.evaluate(() => window.openPencil?.getStore?.().state.snapGuides)
  ).toEqual([])
  editor.canvas.assertNoErrors()
})

test('a click without a drag inside a selected top-level frame selects the layer', async () => {
  const { frame, path } = await selectedIcon()
  await editor.canvas.waitForRender()

  await editor.canvas.click(220, 230)

  await expect.poll(async () => (await layer(path)).selected).toEqual([path])
  expect(await layer(frame)).toMatchObject({ x: 200, y: 200 })
  editor.canvas.assertNoErrors()
})
