import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/demo')

function layerRows() {
  return editor.page.locator('[data-node-id]')
}

async function getLayerNames(): Promise<string[]> {
  const rows = layerRows()
  const count = await rows.count()
  const names: string[] = []
  for (let i = 0; i < count; i++) {
    const text = await rows.nth(i).innerText()
    names.push(text.trim())
  }
  return names
}

interface SceneTreeNode {
  name: string
  type: string
  children: SceneTreeNode[]
}

async function getSceneTree(): Promise<SceneTreeNode> {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) return null

    function nodeTree(id: string): SceneTreeNode | null {
      const node = store.graph.getNode(id)
      if (!node) return null
      return {
        name: node.name,
        type: node.type,
        children: node.childIds.map((cid: string) => nodeTree(cid)).filter(Boolean)
      }
    }
    const tree = nodeTree(store.state.currentPageId)
    if (!tree) throw new Error('Missing current page tree')
    return tree
  })
}

async function getSelectedCount(): Promise<number> {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.selectedIds.size
  })
}

test('demo layers visible in panel', async () => {
  const names = await getLayerNames()
  expect(names).toContain('Components')
  expect(names).toContain('App Preview')
})

test('clicking a node inside a frame does not reparent it', async () => {
  const beforeTree = await getSceneTree()
  const section = beforeTree.children.find((c) => c.name === 'App Preview')
  const dashboard = section?.children.find((c) => c.name === 'Dashboard')
  expect(dashboard).toBeTruthy()
  const sidebarBefore = dashboard?.children.find((c) => c.name === 'Sidebar')
  expect(sidebarBefore).toBeTruthy()

  // Click inside the App Preview section area
  await editor.canvas.click(350, 310)
  await editor.canvas.waitForRender()

  // Sidebar should still be a child of Dashboard
  const afterTree = await getSceneTree()
  const afterSection = afterTree.children.find((c) => c.name === 'App Preview')
  const afterDashboard = afterSection?.children.find((c) => c.name === 'Dashboard')
  expect(afterDashboard?.children.find((c) => c.name === 'Sidebar')).toBeTruthy()

  editor.canvas.assertNoErrors()
})

test('creating a shape updates layers', async () => {
  const before = await getLayerNames()
  await editor.canvas.drawRect(600, 500, 50, 50)
  const names = await getLayerNames()
  expect(names).toContain('Rectangle')
  expect(names.length).toBe(before.length + 1)

  await editor.canvas.undo()
  const after = await getLayerNames()
  expect(after.length).toBe(before.length)
  expect(after).not.toContain('Rectangle')
})

test('Shift+A wraps selection in auto-layout frame', async () => {
  // Draw two loose rectangles for this test
  await editor.canvas.drawRect(700, 600, 60, 60)
  await editor.canvas.drawRect(800, 600, 60, 60)
  await editor.canvas.selectAll()
  const count = await getSelectedCount()
  expect(count).toBeGreaterThanOrEqual(2)

  const before = await getLayerNames()

  await editor.page.keyboard.press('Shift+A')
  await editor.canvas.waitForRender()

  const tree = await getSceneTree()
  const autoFrame = tree.children.find((c) => c.name === 'Frame' && c.type === 'FRAME')
  expect(autoFrame).toBeTruthy()

  const after = await getLayerNames()
  expect(after).not.toEqual(before)
  expect(after).toContain('Frame')

  editor.canvas.assertNoErrors()
})

test('grouping updates layers', async () => {
  // Undo the auto-layout to restore flat structure
  await editor.canvas.undo()
  await editor.canvas.undo()
  await editor.canvas.waitForRender()

  // Draw two rects and group them
  await editor.canvas.drawRect(700, 600, 60, 60)
  await editor.canvas.drawRect(800, 600, 60, 60)
  await editor.canvas.selectAll()

  await editor.page.keyboard.press('Meta+g')
  await editor.canvas.waitForRender()

  const tree = await getSceneTree()
  const group = tree.children.find((c) => c.name === 'Group' && c.type === 'GROUP')
  expect(group).toBeTruthy()

  const names = await getLayerNames()
  expect(names).toContain('Group')

  editor.canvas.assertNoErrors()
})

test('ungrouping updates layers', async () => {
  await editor.page.keyboard.press('Shift+Meta+g')
  await editor.canvas.waitForRender()

  const names = await getLayerNames()
  expect(names).not.toContain('Group')
  expect(names).toContain('Rectangle')

  editor.canvas.assertNoErrors()
})

test('double-click layer to rename', async () => {
  await editor.canvas.drawRect(900, 600, 50, 50)
  await editor.canvas.waitForRender()

  const row = layerRows().filter({ hasText: 'Rectangle' }).first()
  await row.dblclick()

  const input = editor.page.getByTestId('layers-item-input')
  await expect(input).toBeVisible()
  await input.fill('Renamed Layer')
  await input.press('Enter')

  await editor.canvas.waitForRender()
  const names = await getLayerNames()
  expect(names).toContain('Renamed Layer')

  editor.canvas.assertNoErrors()
})

test('clicking outside rename input commits', async () => {
  const row = layerRows().filter({ hasText: 'Renamed Layer' }).first()
  await row.dblclick()

  const input = editor.page.getByTestId('layers-item-input')
  await expect(input).toBeVisible()
  await input.fill('After Outside Click')

  await editor.page.mouse.click(500, 400)
  await editor.canvas.waitForRender()

  await expect(input).not.toBeVisible()
  const names = await getLayerNames()
  expect(names).toContain('After Outside Click')

  editor.canvas.assertNoErrors()
})

test('clearing a layer name falls back to the default node name', async () => {
  await editor.canvas.drawRect(980, 600, 50, 50)
  await editor.canvas.waitForRender()

  const row = layerRows().filter({ hasText: 'Rectangle' }).last()
  const countBefore = await layerRows().count()

  await row.dblclick()

  const input = editor.page.getByTestId('layers-item-input')
  await expect(input).toBeVisible()
  await input.clear()
  await input.press('Enter')

  await editor.canvas.waitForRender()

  const countAfter = await layerRows().count()
  expect(countAfter).toBe(countBefore)

  const names = await getLayerNames()
  expect(names.filter((name) => name === 'Rectangle').length).toBeGreaterThan(0)

  editor.canvas.assertNoErrors()
})

test('double-click does not toggle tree expand', async () => {
  const rowCountBefore = await layerRows().count()

  const containerRow = layerRows().filter({ hasText: 'Components' }).first()
  await containerRow.dblclick()
  await editor.canvas.waitForRender()

  const input = editor.page.getByTestId('layers-item-input')
  await expect(input).toBeVisible()
  await input.press('Escape')

  const rowCountAfter = await layerRows().count()
  expect(rowCountAfter).toBe(rowCountBefore)

  editor.canvas.assertNoErrors()
})
