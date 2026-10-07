import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { waitForDemo } from '#tests/helpers/demo'

async function openDemo(page: Page) {
  const canvas = new CanvasHelper(page)
  await page.goto('/demo?no-chrome&no-rulers')
  await canvas.waitForInit()
  await waitForDemo(page)
  return canvas
}
test.use({ viewport: { width: 1200, height: 1300 } })

for (const [name, snapshot] of [
  ['01 · Components & variables', 'demo-components-and-variables'],
  ['02 · Typography', 'demo-typography'],
  ['03 · Paint & effects', 'demo-paint'],
  ['04 · Controls', 'demo-controls']
] as const) {
  test(`demo startup and page navigation: ${name}`, async ({ page }) => {
    const canvas = await openDemo(page)
    const bounds = await page.evaluate(async (name) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const page = store.graph.getPages().find((page) => page.name === name)
      if (!page) throw new Error(`Missing page: ${name}`)
      await store.switchPage(page.id)
      const [root] = store.graph.getChildren(page.id)
      return {
        x: root.x * store.state.zoom + store.state.panX,
        y: root.y * store.state.zoom + store.state.panY,
        width: root.width * store.state.zoom,
        height: root.height * store.state.zoom
      }
    }, name)
    const box = await canvas.canvas.boundingBox()
    if (!box) throw new Error('Canvas unavailable')
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(box.width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(box.height)
    await canvas.waitForRender()
    canvas.assertNoErrors()
    expect(await canvas.screenshotCanvasRegion(1200, 1300)).toMatchSnapshot(`${snapshot}.png`, {
      maxDiffPixels: 100
    })
  })
}

test('the demo opens as a document with every page', async ({ page }) => {
  await openDemo(page)
  const opened = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    return {
      name: store.state.documentName,
      pages: store.graph.getPages().map((item) => item.name),
      preparing: store.state.preparation !== null
    }
  })
  expect(opened).toEqual({
    name: 'Demo',
    pages: [
      '01 · Components & variables',
      '02 · Typography',
      '03 · Paint & effects',
      '04 · Controls'
    ],
    preparing: false
  })
})

test('demo tokens and main-component edits survive undo', async ({ page }) => {
  await openDemo(page)
  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const graph = store.graph
    // The demo is opened from `.fig`, which gives variables and modes ids of its own.
    const collection = [...graph.variableCollections.values()].find(
      (item) => item.name === 'Announcement / Color'
    )
    const token = [...graph.variables.values()].find(
      (item) => item.name === 'Accent' && item.collectionId === collection?.id
    )
    if (!collection || !token) throw new Error('Accent token unavailable')
    const mode = collection.defaultModeId
    const original = structuredClone(token.valuesByMode[mode])
    store.updateVariableValue(token.id, mode, { r: 0.05, g: 0.55, b: 0.5, a: 1 })
    const changed = structuredClone(token.valuesByMode[mode])
    store.undoAction()
    const restored = structuredClone(token.valuesByMode[mode])
    const component = Array.from(graph.getAllNodes()).find(
      (node) => node.type === 'COMPONENT' && node.name === 'Announcement'
    )
    if (!component) throw new Error('Announcement component unavailable')
    const content = graph.getChildren(component.id).find((node) => node.name === 'Content')
    if (!content) throw new Error('Component content unavailable')
    const headline = graph.getChildren(content.id).find((node) => node.name === 'Headline')
    if (!headline) throw new Error('Headline unavailable')
    const instances = Array.from(graph.getAllNodes()).filter(
      (node) => node.type === 'INSTANCE' && node.componentId === component.id
    )
    const headlines = () =>
      instances.map((instance) => {
        const content = graph.getChildren(instance.id).find((node) => node.name === 'Content')
        if (!content) throw new Error('Instance content unavailable')
        return graph.getChildren(content.id).find((node) => node.name === 'Headline')?.text
      })
    store.updateNodeWithUndo(
      headline.id,
      { text: 'Open studio: bring your next idea' },
      'Edit demo headline'
    )
    await store.loadFontsForNodes([component.id])
    const editedHeadlines = headlines()
    store.undoAction()
    await store.loadFontsForNodes([component.id])
    return { original, changed, restored, editedHeadlines, restoredHeadlines: headlines() }
  })
  expect(result.changed).not.toEqual(result.original)
  expect(result.restored).toEqual(result.original)
  expect(result.editedHeadlines).toEqual([
    'Open studio: bring your next idea',
    'Open studio: bring your next idea'
  ])
  expect(result.restoredHeadlines).toEqual(['Open studio', 'Open studio'])
})
