import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

// Matches Figma desktop 126: hovering a flow auto layout frame dots its direct children, a single
// selected layer dots its flow auto layout parent, and neither shows on plain frames or while
// layers move.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion(700, 460)
  expect(buffer).toMatchSnapshot(`${name}.png`, { maxDiffPixelRatio: 0, threshold: 0 })
}

/**
 * A vertical auto layout card holding a title, a horizontal row of two chips, and a button,
 * next to a plain frame with one layer.
 */
async function createCards() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const fill = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
    ]
    const padding = (value: number) => ({
      paddingTop: value,
      paddingRight: value,
      paddingBottom: value,
      paddingLeft: value
    })
    const card = graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 60,
      y: 60,
      width: 240,
      height: 300,
      fills: fill(1, 1, 1),
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
      ...padding(24)
    })
    const title = graph.createNode('RECTANGLE', card.id, {
      name: 'Title',
      x: 24,
      y: 24,
      width: 192,
      height: 40,
      fills: fill(0.85, 0.85, 0.9)
    })
    const row = graph.createNode('FRAME', card.id, {
      name: 'Row',
      x: 24,
      y: 80,
      width: 192,
      height: 60,
      fills: fill(0.95, 0.95, 0.97),
      layoutMode: 'HORIZONTAL',
      itemSpacing: 10,
      ...padding(10)
    })
    for (const x of [10, 70]) {
      graph.createNode('RECTANGLE', row.id, {
        name: 'Chip',
        x,
        y: 10,
        width: 50,
        height: 40,
        fills: fill(0.9, 0.6, 0.3)
      })
    }
    graph.createNode('RECTANGLE', card.id, {
      name: 'Button',
      x: 24,
      y: 156,
      width: 192,
      height: 40,
      fills: fill(0.2, 0.4, 1)
    })
    const plain = graph.createNode('FRAME', pageId, {
      name: 'Plain',
      x: 360,
      y: 60,
      width: 240,
      height: 300,
      fills: fill(1, 1, 1)
    })
    graph.createNode('RECTANGLE', plain.id, {
      name: 'Layer',
      x: 24,
      y: 24,
      width: 192,
      height: 40,
      fills: fill(0.85, 0.85, 0.9)
    })
    store.clearSelection()
    store.requestRender()
    return { card: card.id, title: title.id, row: row.id, plain: plain.id }
  })
}

async function show(selected: string[], hovered: string | null) {
  await editor.page.evaluate(
    ({ selected, hovered }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.select(selected)
      store.setHoveredNode(hovered)
      store.requestRender()
    },
    { selected, hovered }
  )
  await editor.canvas.waitForRender()
}

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

test('a hovered auto layout frame dots its direct children', async () => {
  const { card } = await createCards()
  await show([], card)
  await expectCanvas('layout-outlines-hovered-card')
})

test('a hovered nested auto layout frame dots only its own children', async () => {
  const { row } = await createCards()
  await show([], row)
  await expectCanvas('layout-outlines-hovered-row')
})

test('a selected layer dots its auto layout parent', async () => {
  const { title } = await createCards()
  await show([title], null)
  await expectCanvas('layout-outlines-selected-child')
})

test('a hovered plain frame shows no outlines', async () => {
  const { plain } = await createCards()
  await show([], plain)
  await expectCanvas('layout-outlines-hovered-plain')
})

test('outlines step aside while a layer moves', async () => {
  const { card, title } = await createCards()
  await show([title], null)
  const from = await at(card, 120, 44)
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')

  await editor.page.mouse.move(box.x + from.x, box.y + from.y)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + from.x + 4, box.y + from.y + 4, { steps: 4 })
  await expect
    .poll(() => editor.page.evaluate(() => window.openPencil?.getStore?.().state.transforming))
    .toBe(true)
  await editor.canvas.waitForRender()
  await expectCanvas('layout-outlines-moving-child')

  await editor.page.mouse.up()
  await expect
    .poll(() => editor.page.evaluate(() => window.openPencil?.getStore?.().state.transforming))
    .toBe(false)
})
