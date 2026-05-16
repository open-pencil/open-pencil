import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

import { expectDefined } from '#tests/helpers/assert'
import { getSelectedNode } from '#tests/helpers/store'

const editor = useEditorSetup()


function getPageChildren() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).map((n) => ({
      type: n.type,
      name: n.name,
      text: n.text
    }))
  })
}

test('pressing T activates text tool', async () => {
  await editor.page.keyboard.press('t')

  const tool = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.activeTool
  })
  expect(tool).toBe('TEXT')
})

test('clicking with text tool creates a text node', async () => {
  await editor.canvas.click(200, 200)
  await editor.canvas.waitForRender()

  // Wait a tick for text editing mode to activate
  await editor.page.waitForTimeout(200)

  const children = await getPageChildren()
  const textNode = children.find((c) => c.type === 'TEXT')
  expect(textNode).toBeTruthy()
})

test('text node is selected after creation', async () => {
  const node = await getSelectedNode(editor.page)
  expect(node?.type).toBe('TEXT')
})

test('typography section appears for text node', async () => {
  // Exit text editing mode
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  // Re-select the text node
  await editor.canvas.click(200, 200)
  await editor.canvas.waitForRender()

  const typoSection = editor.page.getByTestId('typography-section')
  await expect(typoSection).toBeVisible()
})

test('text node has default font properties', async () => {
  const node = await getSelectedNode(editor.page)
  expect(node?.fontSize).toBeGreaterThan(0)
  expect(node?.fontFamily).toBeTruthy()
})

test('creating text via store works', async () => {
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('TEXT', 100, 300, 200, 30)
    store.graph.updateNode(id, { text: 'Hello World', fontSize: 24, fontFamily: 'Inter' })
    store.select([id])
  })
  await editor.canvas.waitForRender()

  const node = await getSelectedNode(editor.page)
  expect(node?.text).toBe('Hello World')
  expect(node?.fontSize).toBe(24)
})

test('undo removes text node', async () => {
  const beforeCount = (await getPageChildren()).length

  await editor.canvas.undo()
  await editor.canvas.waitForRender()

  const afterCount = (await getPageChildren()).length
  expect(afterCount).toBe(beforeCount - 1)
})

test('frame tool creates FRAME node', async () => {
  await editor.page.keyboard.press('f')
  await editor.canvas.drag(400, 100, 600, 250)
  await editor.canvas.waitForRender()

  const node = expectDefined(await getSelectedNode(editor.page), 'selected frame')
  expect(node.type).toBe('FRAME')
  expect(node.width).toBeGreaterThan(0)
  expect(node.height).toBeGreaterThan(0)

  editor.canvas.assertNoErrors()
})

test('Enter key opens text editing and selects all without erasing', async () => {
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  const textId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('TEXT', 300, 300, 200, 30)
    store.graph.updateNode(id, { text: 'Keep this text' })
    store.select([id])
    store.requestRender()
    return id
  })
  await editor.canvas.waitForRender()

  const before = await getSelectedNode(editor.page)
  expect(before?.text).toBe('Keep this text')
  expect(before?.type).toBe('TEXT')

  await editor.page.keyboard.press('Enter')
  await editor.page.waitForTimeout(200)

  const editing = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.editingTextId
  })
  expect(editing).toBe(textId)

  const after = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.state.editingTextId
    if (!id) return null
    return store.graph.getNode(id)?.text ?? null
  })
  expect(after).toBe('Keep this text')
})
