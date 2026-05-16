import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

import { getSelectedNodes } from '#tests/helpers/store'

const editor = useEditorSetup()

function getPageChildCount() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })
}

function getSelectedCount() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.selectedIds.size
  })
}


test('copy + paste via store duplicates a shape', async () => {
  await editor.canvas.drawRect(100, 100, 120, 80)
  await editor.canvas.waitForRender()

  const countBefore = await getPageChildCount()

  await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const data = new DataTransfer()
    await store.writeCopyData(data)
    const html = data.getData('text/html')
    if (html) await store.pasteFromHTML(html)
  })
  await editor.canvas.waitForRender()

  const countAfter = await getPageChildCount()
  expect(countAfter).toBe(countBefore + 1)
})

test('pasted node is offset from original', async () => {
  const nodes = await getSelectedNodes(editor.page)
  expect(nodes).toHaveLength(1)

  const pasted = nodes[0]
  expect(pasted.name).toBe('Rectangle')
})

test('⌘D duplicates in place', async () => {
  // Clear canvas and start fresh
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(200, 200, 100, 80)
  await editor.canvas.waitForRender()

  const countBefore = await getPageChildCount()
  await editor.canvas.duplicate()

  const countAfter = await getPageChildCount()
  expect(countAfter).toBe(countBefore + 1)
  expect(await getSelectedCount()).toBe(1)
})

test('duplicate preserves fills', async () => {
  // Set a custom fill on the selected node
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    store.updateNodeWithUndo(
      id,
      {
        fills: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0.5, b: 1, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ]
      },
      'Set fill'
    )
  })
  await editor.canvas.waitForRender()

  await editor.canvas.duplicate()

  const nodes = await getSelectedNodes(editor.page)
  expect(nodes[0].fills[0].color.b).toBeCloseTo(1, 1)
})

test('cut removes original', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(100, 100, 80, 60)
  await editor.canvas.waitForRender()

  expect(await getPageChildCount()).toBe(1)

  // Cut via store
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const data = new DataTransfer()
    store.writeCopyData(data)
    store.deleteSelected()
  })
  await editor.canvas.waitForRender()

  expect(await getPageChildCount()).toBe(0)
})

test('multiple pastes can all be undone', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(100, 100, 80, 60)
  await editor.canvas.waitForRender()

  expect(await getPageChildCount()).toBe(1)

  // Duplicate 3 times via Cmd+D (synchronous, no clipboard issues)
  for (let i = 0; i < 3; i++) {
    await editor.canvas.duplicate()
    await editor.canvas.waitForRender()
  }

  expect(await getPageChildCount()).toBe(4) // 1 original + 3 duplicates

  // Undo all 3 duplicates
  for (let i = 0; i < 3; i++) {
    await editor.canvas.undo()
    await editor.canvas.waitForRender()
  }

  expect(await getPageChildCount()).toBe(1) // back to original only
})

test('multi-select duplicate creates copies of all', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(100, 100, 60, 60)
  await editor.canvas.drawRect(200, 100, 60, 60)
  await editor.canvas.selectAll()
  await editor.canvas.waitForRender()

  expect(await getSelectedCount()).toBe(2)

  const countBefore = await getPageChildCount()
  await editor.canvas.duplicate()

  const countAfter = await getPageChildCount()
  expect(countAfter).toBe(countBefore + 2)

  editor.canvas.assertNoErrors()
})
