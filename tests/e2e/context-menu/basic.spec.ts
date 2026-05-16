import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetup()

function getPageChildren() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).map((n) => ({
      id: n.id,
      type: n.type,
      name: n.name,
      visible: n.visible,
      locked: n.locked
    }))
  })
}

function getSelectedCount() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.selectedIds.size
  })
}

async function rightClickShape(x: number, y: number) {
  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  await editor.page.mouse.click(box.x + x, box.y + y, { button: 'right' })
}

function contextMenu() {
  return editor.page.locator('[role="menu"]')
}

function contextItem(testId: string) {
  return editor.page.getByTestId(testId)
}

test('right-click on empty canvas shows context menu without selection items disabled', async () => {
  await rightClickShape(500, 400)

  await expect(contextMenu()).toBeVisible()

  const copyItem = contextItem('context-copy')
  await expect(copyItem).toBeVisible()

  await editor.page.keyboard.press('Escape')
})

test('draw shape and right-click selects it', async () => {
  await editor.canvas.drawRect(200, 200, 120, 80)
  await editor.canvas.waitForRender()

  // Deselect first
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  // Right-click the shape
  await rightClickShape(250, 230)

  expect(await getSelectedCount()).toBe(1)
  await expect(contextMenu()).toBeVisible()
})

test('context menu shows expected items', async () => {
  await expect(contextItem('context-copy')).toBeVisible()
  await expect(contextItem('context-cut')).toBeVisible()
  await expect(contextItem('context-duplicate')).toBeVisible()
  await expect(contextItem('context-delete')).toBeVisible()
  await expect(contextItem('context-group')).toBeVisible()
  await expect(contextItem('context-bring-to-front')).toBeVisible()
  await expect(contextItem('context-send-to-back')).toBeVisible()
  await expect(contextItem('context-toggle-visibility')).toBeVisible()
  await expect(contextItem('context-toggle-lock')).toBeVisible()

  await editor.page.keyboard.press('Escape')
})

test('duplicate via context menu works', async () => {
  const countBefore = (await getPageChildren()).length

  await rightClickShape(250, 230)
  await contextItem('context-duplicate').click()
  await editor.canvas.waitForRender()

  const countAfter = (await getPageChildren()).length
  expect(countAfter).toBe(countBefore + 1)
})

test('toggle visibility via context menu', async () => {
  await editor.canvas.click(250, 230)
  await editor.canvas.waitForRender()

  const nodeId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds][0]
  })

  await rightClickShape(250, 230)
  await contextItem('context-toggle-visibility').click()
  await editor.canvas.waitForRender()

  const hidden = await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const n = store.graph.getNode(id)
    return n ? { visible: n.visible } : null
  }, nodeId)
  expect(hidden?.visible).toBe(false)

  // Toggle back: select via store since invisible nodes can't be hit-tested
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.toggleVisibility()
  })
  await editor.canvas.waitForRender()

  const restored = await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const n = store.graph.getNode(id)
    return n ? { visible: n.visible } : null
  }, nodeId)
  expect(restored?.visible).toBe(true)
})

test('toggle lock via context menu', async () => {
  await rightClickShape(250, 230)
  await contextItem('context-toggle-lock').click()
  await editor.canvas.waitForRender()

  const children = await getPageChildren()
  const locked = children.find((c) => c.locked)
  expect(locked).toBeTruthy()

  // Unlock
  await rightClickShape(250, 230)
  await contextItem('context-toggle-lock').click()
  await editor.canvas.waitForRender()

  const after = await getPageChildren()
  expect(after.every((c) => !c.locked)).toBe(true)
})

test('delete via context menu removes node', async () => {
  const countBefore = (await getPageChildren()).length

  await rightClickShape(250, 230)
  await contextItem('context-delete').click()
  await editor.canvas.waitForRender()

  const countAfter = (await getPageChildren()).length
  expect(countAfter).toBe(countBefore - 1)
})

test('group via context menu', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(100, 100, 60, 60)
  await editor.canvas.drawRect(200, 100, 60, 60)
  await editor.canvas.selectAll()
  await editor.canvas.waitForRender()

  await rightClickShape(130, 130)
  await contextItem('context-group').click()
  await editor.canvas.waitForRender()

  const children = await getPageChildren()
  const group = children.find((c) => c.type === 'GROUP')
  expect(group).toBeTruthy()
})

test('ungroup via store after context-menu group', async () => {
  // Groups are click-through, so ungroup via store instead
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const group = store.graph.getChildren(store.state.currentPageId).find((n) => n.type === 'GROUP')
    if (group) store.select([group.id])
    store.ungroupSelected()
  })
  await editor.canvas.waitForRender()

  const children = await getPageChildren()
  expect(children.every((c) => c.type !== 'GROUP')).toBe(true)
  expect(children.length).toBe(2)

  editor.canvas.assertNoErrors()
})

test('create component via context menu', async () => {
  await editor.canvas.click(130, 130)
  await editor.canvas.waitForRender()

  await rightClickShape(130, 130)
  await contextItem('context-create-component').click()
  await editor.canvas.waitForRender()

  const children = await getPageChildren()
  const comp = children.find((c) => c.type === 'COMPONENT')
  expect(comp).toBeTruthy()

  editor.canvas.assertNoErrors()
})

test('Copy/Paste as submenu exists', async () => {
  await rightClickShape(130, 130)

  const submenuTrigger = contextItem('context-copy-paste-as')
  await expect(submenuTrigger).toBeVisible()

  await submenuTrigger.hover()
  await editor.page.waitForTimeout(300)

  await expect(contextItem('context-copy-as-svg')).toBeVisible()
  await expect(contextItem('context-copy-as-jsx')).toBeVisible()

  await editor.page.keyboard.press('Escape')
})
