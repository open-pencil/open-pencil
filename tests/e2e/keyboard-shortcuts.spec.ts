import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

function getActiveTool() {
  return page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.activeTool)
}

function getSelectedCount() {
  return page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.selectedIds.size)
}

function getPageChildren() {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return store.graph.getChildren(store.state.currentPageId).map((n) => ({
      id: n.id,
      type: n.type,
      name: n.name,
      childIds: n.childIds
    }))
  })
}

function getUIVisible() {
  return page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.showUI)
}

test.describe('tool switching', () => {
  test('V → SELECT', async () => {
    await page.keyboard.press('v')
    expect(await getActiveTool()).toBe('SELECT')
  })

  test('R → RECTANGLE', async () => {
    await page.keyboard.press('r')
    expect(await getActiveTool()).toBe('RECTANGLE')
  })

  test('O → ELLIPSE', async () => {
    await page.keyboard.press('o')
    expect(await getActiveTool()).toBe('ELLIPSE')
  })

  test('F → FRAME', async () => {
    await page.keyboard.press('f')
    expect(await getActiveTool()).toBe('FRAME')
  })

  test('T → TEXT', async () => {
    await page.keyboard.press('t')
    expect(await getActiveTool()).toBe('TEXT')
  })

  test('L → LINE', async () => {
    await page.keyboard.press('l')
    expect(await getActiveTool()).toBe('LINE')
  })

  test('P → PEN', async () => {
    await page.keyboard.press('p')
    expect(await getActiveTool()).toBe('PEN')
  })

  test('H → HAND', async () => {
    await page.keyboard.press('h')
    expect(await getActiveTool()).toBe('HAND')
  })

  test('S → SECTION', async () => {
    await page.keyboard.press('s')
    expect(await getActiveTool()).toBe('SECTION')
  })
})

test.describe('selection shortcuts', () => {
  test('⌘A selects all', async () => {
    await page.keyboard.press('v')
    await canvas.drawRect(100, 100, 60, 60)
    await canvas.drawRect(200, 100, 60, 60)

    await page.keyboard.press('Meta+a')
    expect(await getSelectedCount()).toBe(2)
  })

  test('Escape clears selection and resets to SELECT tool', async () => {
    await page.keyboard.press('Escape')
    expect(await getSelectedCount()).toBe(0)
    expect(await getActiveTool()).toBe('SELECT')
  })

  test('Backspace deletes selected', async () => {
    await canvas.selectAll()
    const beforeCount = await getSelectedCount()
    expect(beforeCount).toBeGreaterThan(0)

    await page.keyboard.press('Backspace')
    await canvas.waitForRender()

    const children = await getPageChildren()
    expect(children).toHaveLength(0)
  })
})

test.describe('z-order shortcuts', () => {
  test('] brings to front', async () => {
    await canvas.drawRect(100, 100, 60, 60)
    await canvas.drawRect(100, 100, 60, 60)

    const childrenBefore = await getPageChildren()
    const firstId = childrenBefore[0].id

    // Select the first (bottom) node
    await page.evaluate((id) => {
      window.__OPEN_PENCIL_STORE__!.select([id])
    }, firstId)
    await canvas.waitForRender()

    await page.keyboard.press(']')
    await canvas.waitForRender()

    const childrenAfter = await getPageChildren()
    expect(childrenAfter[childrenAfter.length - 1].id).toBe(firstId)
  })

  test('[ sends to back', async () => {
    const children = await getPageChildren()
    const lastId = children[children.length - 1].id

    // Select the last (top) node
    await page.evaluate((id) => {
      window.__OPEN_PENCIL_STORE__!.select([id])
    }, lastId)
    await canvas.waitForRender()

    await page.keyboard.press('[')
    await canvas.waitForRender()

    const after = await getPageChildren()
    expect(after[0].id).toBe(lastId)
  })
})

test.describe('group/ungroup shortcuts', () => {
  test('⌘G groups selection', async () => {
    await canvas.selectAll()
    expect(await getSelectedCount()).toBeGreaterThanOrEqual(2)

    await page.keyboard.press('Meta+g')
    await canvas.waitForRender()

    const children = await getPageChildren()
    const group = children.find((c) => c.type === 'GROUP')
    expect(group).toBeTruthy()
    expect(group!.childIds.length).toBeGreaterThanOrEqual(2)
  })

  test('⌘⇧G ungroups', async () => {
    await page.keyboard.press('Meta+Shift+g')
    await canvas.waitForRender()

    const children = await getPageChildren()
    expect(children.every((c) => c.type !== 'GROUP')).toBe(true)
  })
})

test.describe('UI toggles', () => {
  test('⌘\\ toggles UI visibility', async () => {
    const before = await getUIVisible()

    await page.keyboard.press('Meta+\\')
    await canvas.waitForRender()

    const after = await getUIVisible()
    expect(after).toBe(!before)

    // Restore
    await page.keyboard.press('Meta+\\')
    await canvas.waitForRender()
    expect(await getUIVisible()).toBe(before)
  })
})

test.describe('duplicate', () => {
  test('⌘D duplicates selection', async () => {
    await canvas.clearCanvas()
    await canvas.drawRect(100, 100, 60, 60)
    await canvas.selectAll()
    expect(await getSelectedCount()).toBe(1)

    await page.keyboard.press('Meta+d')
    await canvas.waitForRender()

    const children = await getPageChildren()
    expect(children).toHaveLength(2)
  })
})

test.describe('zoom shortcuts', () => {
  test('⌘0 zooms to 100%', async () => {
    await canvas.clearCanvas()
    await canvas.drawRect(100, 100, 60, 60)

    // Set zoom to something other than 100%
    await page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      store.state.zoom = 2
    })
    await canvas.waitForRender()

    await page.keyboard.press('Meta+0')
    await canvas.waitForRender()

    const zoomAfter = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.zoom)
    expect(zoomAfter).toBe(1)
  })

  test('⌘1 zooms to fit', async () => {
    await page.keyboard.press('Meta+1')
    await canvas.waitForRender()

    const zoom = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.zoom)
    expect(zoom).toBeGreaterThan(0)
    expect(zoom).toBeLessThanOrEqual(1)
  })

  test('⌘2 zooms to selection', async () => {
    await canvas.selectAll()

    await page.keyboard.press('Meta+2')
    await canvas.waitForRender()

    const zoom = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.zoom)
    expect(zoom).toBeGreaterThan(0)
    expect(zoom).toBeLessThanOrEqual(1)
  })

  test('⇧1 zooms to fit (same as ⌘1)', async () => {
    await page.keyboard.press('Shift+1')
    await canvas.waitForRender()

    const zoom = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.zoom)
    expect(zoom).toBeGreaterThan(0)
    expect(zoom).toBeLessThanOrEqual(1)
  })

  test('⇧2 zooms to selection (same as ⌘2)', async () => {
    await canvas.selectAll()

    await page.keyboard.press('Shift+2')
    await canvas.waitForRender()

    const zoom = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.zoom)
    expect(zoom).toBeGreaterThan(0)
    expect(zoom).toBeLessThanOrEqual(1)
  })
})

test.describe('undo/redo', () => {
  test('⌘Z undoes last action', async () => {
    await canvas.clearCanvas()
    await canvas.drawRect(100, 100, 60, 60)
    expect((await getPageChildren()).length).toBe(1)

    await page.keyboard.press('Meta+z')
    await canvas.waitForRender()

    expect((await getPageChildren()).length).toBe(0)
  })

  test('⌘⇧Z redoes undone action', async () => {
    await page.keyboard.press('Meta+Shift+z')
    await canvas.waitForRender()

    expect((await getPageChildren()).length).toBe(1)
  })
})

test.describe('auto-layout shortcut', () => {
  test('⇧A toggles auto-layout on frame', async () => {
    await canvas.clearCanvas()
    await canvas.drawRect(100, 100, 200, 200)
    await canvas.selectAll()

    // Change to frame type for auto-layout
    await page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const nodes = [...store.state.selectedIds]
      if (nodes[0]) store.updateNode(nodes[0], { type: 'FRAME' })
    })
    await canvas.waitForRender()

    const layoutBefore = await page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const nodes = [...store.state.selectedIds]
      return store.graph.getNode(nodes[0])?.layoutMode
    })
    expect(layoutBefore).toBe('NONE')

    await page.keyboard.press('Shift+a')
    await canvas.waitForRender()

    const layoutAfter = await page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const nodes = [...store.state.selectedIds]
      return store.graph.getNode(nodes[0])?.layoutMode
    })
    expect(layoutAfter).toBe('VERTICAL')

    // Toggle off
    await page.keyboard.press('Shift+a')
    await canvas.waitForRender()

    const layoutFinal = await page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const nodes = [...store.state.selectedIds]
      return store.graph.getNode(nodes[0])?.layoutMode
    })
    expect(layoutFinal).toBe('NONE')
  })
})
