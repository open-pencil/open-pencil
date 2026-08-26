import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function pageChildren() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const page = store.graph.getNode(store.state.currentPageId)
    if (!page) throw new Error('Current page not found')
    return page.childIds
      .map((id: string) => {
        const node = store.graph.getNode(id)
        return node
          ? {
              id: node.id,
              type: node.type,
              x: node.x,
              y: node.y,
              width: node.width,
              height: node.height
            }
          : null
      })
      .filter((node): node is NonNullable<typeof node> => node !== null)
  })
}

test('empty canvas', async () => {
  expect(await pageChildren()).toEqual([])
})

test('draw rectangle', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  const [rectangle] = await pageChildren()
  expect(rectangle).toMatchObject({ type: 'RECTANGLE', x: 100, y: 100, width: 200, height: 150 })
})

test('draw ellipse', async () => {
  await editor.canvas.drawEllipse(100, 100, 200, 150)
  const [ellipse] = await pageChildren()
  expect(ellipse).toMatchObject({ type: 'ELLIPSE', x: 100, y: 100, width: 200, height: 150 })
})

test('draw rectangle then move it', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  await editor.canvas.selectTool('select')
  await editor.canvas.drag(200, 175, 400, 300)
  await editor.canvas.waitForRender()
  const [moved] = await pageChildren()
  expect(moved).toMatchObject({ type: 'RECTANGLE', x: 300, y: 225, width: 200, height: 150 })
})

test('draw and delete', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  await editor.canvas.deleteSelection()
  expect(await pageChildren()).toEqual([])
})

test('draw and undo', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  await editor.canvas.undo()
  expect(await pageChildren()).toEqual([])
})
