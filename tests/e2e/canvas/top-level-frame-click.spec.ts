import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

// Matches Figma desktop 126 with the same pointer input: the gaps and padding of a top-level auto
// layout frame select, highlight, and drag it, while those of a plain top-level frame are background.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

/** A top-level card with auto layout and one without, each holding a title and a button. */
async function createCards() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const fill = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
    ]
    const card = (name: string, x: number, layoutMode: 'VERTICAL' | 'NONE') => {
      const frame = store.graph.createNode('FRAME', pageId, {
        name,
        x,
        y: 100,
        width: 200,
        height: 240,
        fills: fill(1, 1, 1),
        layoutMode,
        itemSpacing: 24,
        paddingTop: 24,
        paddingRight: 24,
        paddingBottom: 24,
        paddingLeft: 24
      })
      store.graph.createNode('RECTANGLE', frame.id, {
        name: `${name} title`,
        x: 24,
        y: 24,
        width: 152,
        height: 40,
        fills: fill(0.85, 0.85, 0.9)
      })
      store.graph.createNode('RECTANGLE', frame.id, {
        name: `${name} button`,
        x: 24,
        y: 88,
        width: 152,
        height: 40,
        fills: fill(0.2, 0.4, 1)
      })
      return frame.id
    }
    const ids = { auto: card('Auto card', 100, 'VERTICAL'), plain: card('Plain card', 400, 'NONE') }
    store.clearSelection()
    store.requestRender()
    return ids
  })
}

/** Canvas coordinates of a point given relative to a node's top-left corner. */
async function at(id: string, dx: number, dy: number) {
  return editor.page.evaluate(
    ({ id, dx, dy }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const abs = store.graph.getAbsolutePosition(id)
      const { zoom, panX, panY } = store.state
      return { x: (abs.x + dx) * zoom + panX, y: (abs.y + dy) * zoom + panY }
    },
    { id, dx, dy }
  )
}

async function state() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return { selected: [...store.state.selectedIds], hovered: store.state.hoveredNodeId }
  })
}

async function position(id: string) {
  return editor.page.evaluate((nodeId) => {
    const node = window.openPencil?.getStore?.().graph.getNode(nodeId)
    return node ? { x: node.x, y: node.y } : null
  }, id)
}

test('hovering and clicking the empty area of a top-level auto layout frame selects it', async () => {
  const { auto } = await createCards()
  await editor.canvas.waitForRender()
  const gap = await at(auto, 100, 200)

  await editor.canvas.hover(gap.x, gap.y)
  await expect.poll(async () => (await state()).hovered).toBe(auto)

  await editor.canvas.click(gap.x, gap.y)
  await expect.poll(async () => (await state()).selected).toEqual([auto])
  editor.canvas.assertNoErrors()
})

test('a click on a layer in a top-level auto layout frame still selects the layer', async () => {
  const { auto } = await createCards()
  await editor.canvas.waitForRender()
  const button = await at(auto, 100, 108)
  const buttonId = await editor.page.evaluate(
    (frameId) => window.openPencil?.getStore?.().graph.getNode(frameId)?.childIds[1],
    auto
  )

  await editor.canvas.click(button.x, button.y)
  await expect.poll(async () => (await state()).selected).toEqual([buttonId])
  editor.canvas.assertNoErrors()
})

test('dragging the empty area of a top-level auto layout frame moves it', async () => {
  const { auto } = await createCards()
  await editor.canvas.waitForRender()
  const gap = await at(auto, 100, 200)

  await editor.canvas.drag(gap.x, gap.y, gap.x + 60, gap.y + 40)
  await expect.poll(() => position(auto)).toEqual({ x: 160, y: 140 })
  expect((await state()).selected).toEqual([auto])
  editor.canvas.assertNoErrors()
})

test('the empty area of a plain top-level frame stays background', async () => {
  const { plain } = await createCards()
  await editor.canvas.waitForRender()
  const gap = await at(plain, 100, 200)

  await editor.canvas.hover(gap.x, gap.y)
  expect((await state()).hovered).toBeNull()

  await editor.canvas.click(gap.x, gap.y)
  expect((await state()).selected).toEqual([])

  await editor.canvas.drag(gap.x, gap.y, gap.x + 60, gap.y + 40)
  expect(await position(plain)).toEqual({ x: 400, y: 100 })
  editor.canvas.assertNoErrors()
})

test('repeated clicks at one point reach deeper layers, one level at a time', async () => {
  const ids = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const fill = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
    ]
    const page = store.state.currentPageId
    const board = store.graph.createNode('FRAME', page, {
      name: 'Board',
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      fills: fill(1, 1, 1)
    })
    const grid = store.graph.createNode('FRAME', board.id, {
      name: 'Grid',
      x: 20,
      y: 20,
      width: 260,
      height: 260,
      fills: fill(0.95, 0.95, 0.95)
    })
    const cell = store.graph.createNode('FRAME', grid.id, {
      name: 'Cell',
      x: 40,
      y: 40,
      width: 80,
      height: 80,
      fills: fill(0.1, 0.1, 0.1)
    })
    const label = store.graph.createNode('RECTANGLE', cell.id, {
      name: 'Label',
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      fills: fill(1, 1, 1)
    })
    store.clearSelection()
    store.requestRender()
    return { grid: grid.id, cell: cell.id, label: label.id }
  })
  await editor.canvas.waitForRender()
  const point = await at(ids.label, 20, 20)

  for (const expected of [ids.grid, ids.cell, ids.label]) {
    await editor.canvas.click(point.x, point.y)
    await expect.poll(async () => (await state()).selected).toEqual([expected])
    // Apart enough not to count as a double-click, which goes one level deeper by itself.
    await editor.page.waitForTimeout(600)
  }
  editor.canvas.assertNoErrors()
})
