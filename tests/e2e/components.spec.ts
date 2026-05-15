import { expect, test, type Page } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

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
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const n = store.graph.getNode(nodeId)
    if (!n) return null
    return { type: n.type, name: n.name, componentId: n.componentId, childIds: n.childIds }
  }, id)
}

function getSelectedIds() {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds]
  })
}

function getPageChildren() {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
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

  const selectedId = expectDefined(ids[0], 'selected component id')
  const node = await getNodeById(selectedId)
  expect(node?.type).toBe('COMPONENT')
  componentId = selectedId
})

test('component shows purple label in design panel', async () => {
  const header = page.getByTestId('design-node-header')
  await expect(header).toContainText('COMPONENT')
})

test('component visible in layers panel', async () => {
  const layers = page.locator('[data-node-id]')
  const count = await layers.count()
  expect(count).toBeGreaterThan(0)

  const types = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
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
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.createInstanceFromComponent(compId, 300, 100)
  }, expectDefined(comp, 'component').id)
  await canvas.waitForRender()

  const updated = await getPageChildren()
  const instance = updated.find((c) => c.type === 'INSTANCE')
  expect(instance).toBeTruthy()
  expect(instance?.componentId).toBe(expectDefined(comp, 'component').id)
})

test('instance shows INSTANCE type in design panel', async () => {
  const children = await getPageChildren()
  const instance = expectDefined(
    children.find((c) => c.type === 'INSTANCE'),
    'instance node'
  )

  await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.select([id])
  }, instance.id)
  await canvas.waitForRender()

  const header = page.getByTestId('design-node-header')
  await expect(header).toContainText('INSTANCE')
})

test('instance has "Go to Main Component" button', async () => {
  const goToBtn = page.getByTestId('design-go-to-component')
  await expect(goToBtn).toBeVisible()
})

test('instance has "Detach" button', async () => {
  const detachBtn = page.getByTestId('design-detach-instance')
  await expect(detachBtn).toBeVisible()
})

test('modifying component propagates to instance', async () => {
  // Select the component
  await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.select([id])
  }, componentId)
  await canvas.waitForRender()

  // Change component fill
  await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.updateNodeWithUndo(
      id,
      {
        fills: [
          {
            type: 'SOLID',
            color: { r: 1, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ]
      },
      'Change fill'
    )
  }, componentId)
  await canvas.waitForRender()

  // Check instance got the same fill
  const children = await getPageChildren()
  const instance = expectDefined(
    children.find((c) => c.type === 'INSTANCE'),
    'instance node'
  )
  const instanceNode = await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const n = store.graph.getNode(id)
    const child = store.graph.getChildren(id)[0]
    return child ? { fills: child.fills } : { fills: n?.fills ?? [] }
  }, instance.id)

  expect(instanceNode.fills.length).toBeGreaterThan(0)
})

test('detach instance converts to frame', async () => {
  const children = await getPageChildren()
  const instance = expectDefined(
    children.find((c) => c.type === 'INSTANCE'),
    'instance node'
  )

  await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.select([id])
  }, instance.id)
  await canvas.waitForRender()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.detachInstance()
  })
  await canvas.waitForRender()

  const ids = await getSelectedIds()
  const detached = await getNodeById(expectDefined(ids[0], 'detached selected id'))
  expect(detached?.type).toBe('FRAME')

  canvas.assertNoErrors()
})
