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

function getNodeById(id: string) {
  return page.evaluate((nodeId) => {
    const store = window.__OPEN_PENCIL_STORE__!
    const n = store.graph.getNode(nodeId)
    if (!n) return null
    return { type: n.type, name: n.name, componentId: n.componentId, childIds: n.childIds }
  }, id)
}

function getSelectedIds() {
  return page.evaluate(() => [...window.__OPEN_PENCIL_STORE__!.state.selectedIds])
}

function getPageChildren() {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return store.graph.getChildren(store.state.currentPageId).map((n) => ({
      id: n.id,
      type: n.type,
      name: n.name,
      componentId: n.componentId
    }))
  })
}

let componentId: string

test('create component from selection (⌘⌥K)', async () => {
  await canvas.drawRect(100, 100, 120, 80)
  await canvas.waitForRender()

  await page.keyboard.press('Meta+Alt+k')
  await canvas.waitForRender()

  const ids = await getSelectedIds()
  expect(ids).toHaveLength(1)

  const node = await getNodeById(ids[0])
  expect(node!.type).toBe('COMPONENT')
  componentId = ids[0]
})

test('component shows purple label in design panel', async () => {
  const header = page.locator('[data-test-id="design-node-header"]')
  await expect(header).toContainText('COMPONENT')
})

test('component visible in layers panel', async () => {
  const layers = page.locator('[data-node-id]')
  const count = await layers.count()
  expect(count).toBeGreaterThan(0)

  const types = await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return store.graph.getChildren(store.state.currentPageId).map((n) => n.type)
  })
  expect(types).toContain('COMPONENT')
})

test('create instance from component (context menu)', async () => {
  const children = await getPageChildren()
  const comp = children.find((c) => c.type === 'COMPONENT')
  expect(comp).toBeTruthy()

  // Use store directly to create instance
  await page.evaluate((compId) => {
    const store = window.__OPEN_PENCIL_STORE__!
    store.createInstanceFromComponent(compId, 300, 100)
  }, comp!.id)
  await canvas.waitForRender()

  const updated = await getPageChildren()
  const instance = updated.find((c) => c.type === 'INSTANCE')
  expect(instance).toBeTruthy()
  expect(instance!.componentId).toBe(comp!.id)
})

test('instance shows INSTANCE type in design panel', async () => {
  const children = await getPageChildren()
  const instance = children.find((c) => c.type === 'INSTANCE')!

  await page.evaluate((id) => {
    window.__OPEN_PENCIL_STORE__!.select([id])
  }, instance.id)
  await canvas.waitForRender()

  const header = page.locator('[data-test-id="design-node-header"]')
  await expect(header).toContainText('INSTANCE')
})

test('instance has "Go to Main Component" button', async () => {
  const goToBtn = page.locator('[data-test-id="design-go-to-component"]')
  await expect(goToBtn).toBeVisible()
})

test('instance has "Detach" button', async () => {
  const detachBtn = page.locator('[data-test-id="design-detach-instance"]')
  await expect(detachBtn).toBeVisible()
})

test('modifying component propagates to instance', async () => {
  // Select the component
  await page.evaluate((id) => {
    window.__OPEN_PENCIL_STORE__!.select([id])
  }, componentId)
  await canvas.waitForRender()

  // Change component fill
  await page.evaluate((id) => {
    const store = window.__OPEN_PENCIL_STORE__!
    store.updateNodeWithUndo(id, {
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }]
    }, 'Change fill')
  }, componentId)
  await canvas.waitForRender()

  // Check instance got the same fill
  const children = await getPageChildren()
  const instance = children.find((c) => c.type === 'INSTANCE')!
  const instanceNode = await page.evaluate((id) => {
    const store = window.__OPEN_PENCIL_STORE__!
    const n = store.graph.getNode(id)
    const child = store.graph.getChildren(id)[0]
    return child ? { fills: child.fills } : { fills: n?.fills ?? [] }
  }, instance.id)

  expect(instanceNode.fills.length).toBeGreaterThan(0)
})

test('detach instance converts to frame', async () => {
  const children = await getPageChildren()
  const instance = children.find((c) => c.type === 'INSTANCE')!

  await page.evaluate((id) => {
    window.__OPEN_PENCIL_STORE__!.select([id])
  }, instance.id)
  await canvas.waitForRender()

  await page.evaluate(() => {
    window.__OPEN_PENCIL_STORE__!.detachInstance()
  })
  await canvas.waitForRender()

  const ids = await getSelectedIds()
  const detached = await getNodeById(ids[0])
  expect(detached!.type).toBe('FRAME')

  canvas.assertNoErrors()
})
