import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

function getNodeChildren(nodeId: string) {
  return editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(id).map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      parentId: n.parentId
    }))
  }, nodeId)
}

function getSelectedParent() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const node = store.graph.getNode(id)
    return node?.parentId ?? null
  })
}

function createFrameWithChild() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const frameId = store.createShape('FRAME', 50, 50, 300, 200, pageId)
    store.graph.updateNode(frameId, { name: 'Container' })
    const childId = store.createShape('RECTANGLE', 10, 10, 80, 60, frameId)
    store.graph.updateNode(childId, { name: 'Inner Rect' })
    store.requestRender()
    return { frameId, childId, pageId }
  })
}

function selectNode(nodeId: string) {
  return editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.select([id])
    store.requestRender()
  }, nodeId)
}

function copyAndPaste() {
  return editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const data = new DataTransfer()
    await store.writeCopyData(data)
    const html = data.getData('text/html')
    if (html) await store.pasteFromHTML(html)
  })
}

test('paste into selected frame places node as child', async () => {
  await editor.canvas.clearCanvas()
  const { frameId } = await createFrameWithChild()
  await editor.canvas.waitForRender()

  await editor.canvas.drawRect(400, 50, 60, 60)
  await editor.canvas.waitForRender()

  await copyAndPaste()
  await editor.canvas.waitForRender()

  await selectNode(frameId)
  await editor.canvas.waitForRender()

  await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const rect = [...store.graph.nodes.values()].find(
      (n) => n.name === 'Rectangle' && n.type === 'RECTANGLE'
    )
    if (!rect) throw new Error('Rectangle not found')
    store.select([rect.id])

    const data = new DataTransfer()
    await store.writeCopyData(data)
    const html = data.getData('text/html')

    const frame = [...store.graph.nodes.values()].find((n) => n.name === 'Container')
    if (!frame) throw new Error('Container not found')
    store.select([frame.id])

    if (html) await store.pasteFromHTML(html)
  })
  await editor.canvas.waitForRender()

  const children = await getNodeChildren(frameId)
  const pastedChild = children.find((c) => c.name === 'Rectangle')
  expect(pastedChild).toBeDefined()
  expect(pastedChild?.parentId).toBe(frameId)
})

test('paste with child selected places node as sibling in parent frame', async () => {
  await editor.canvas.clearCanvas()
  const { frameId, childId } = await createFrameWithChild()
  await editor.canvas.waitForRender()

  await editor.canvas.drawRect(400, 50, 60, 60)
  await editor.canvas.waitForRender()

  await editor.page.evaluate(
    async ({ childId: cid }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const rect = [...store.graph.nodes.values()].find(
        (n) => n.name === 'Rectangle' && n.type === 'RECTANGLE'
      )
      if (!rect) throw new Error('Rectangle not found')
      store.select([rect.id])

      const data = new DataTransfer()
      await store.writeCopyData(data)
      const html = data.getData('text/html')

      store.select([cid])
      if (html) await store.pasteFromHTML(html)
    },
    { childId }
  )
  await editor.canvas.waitForRender()

  const parent = await getSelectedParent()
  expect(parent).toBe(frameId)

  const children = await getNodeChildren(frameId)
  expect(children.length).toBeGreaterThanOrEqual(2)
})

test('paste with no selection places on page', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(100, 100, 60, 60)
  await editor.canvas.waitForRender()

  await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const data = new DataTransfer()
    await store.writeCopyData(data)
    const html = data.getData('text/html')
    store.clearSelection()
    if (html) await store.pasteFromHTML(html)
  })
  await editor.canvas.waitForRender()

  const parent = await getSelectedParent()
  const pageId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.currentPageId
  })
  expect(parent).toBe(pageId)

  editor.canvas.assertNoErrors()
})
