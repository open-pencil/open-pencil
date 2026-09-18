import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import type * as DemoStartup from '#tests/helpers/canvas/demo-startup'
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
  ['03 · Paint & effects', 'demo-paint']
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

test('demo generation reports canvas preparation until the document is ready', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/demo?no-chrome&no-rulers')
  const loader = page.getByTestId('canvas-loading')
  await expect(loader).toBeVisible()
  await expect(loader).toContainText(
    /Preparing layers|Resolving fonts|Computing layout|Preparing canvas/
  )
  await canvas.waitForInit()
  await waitForDemo(page)
  await expect(loader).toBeHidden()
})

test('an abandoned demo build leaves the document as it was', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/demo?no-chrome&no-rulers')

  const documentState = () =>
    page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      const pages = store.graph.getPages()
      return {
        pages: pages.length,
        name: pages[0]?.name ?? null,
        children: pages[0] ? store.graph.getChildren(pages[0].id).length : -1,
        collections: store.graph.variableCollections.size,
        preparing: store.state.preparation !== null
      }
    })

  await page.waitForFunction(
    () => window.openPencil?.getStore?.()?.state.preparation?.kind === 'demo-load'
  )
  const pristine = await documentState()
  // Wait until generation has touched the document (it has added its extra pages), so the
  // interruption exercises the rollback rather than a build that never started mutating.
  await page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    return store?.state.preparation?.kind === 'demo-load' && store.graph.getPages().length > 1
  })
  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    await store.switchPage(store.graph.getPages()[0].id)
  })

  // The abandoned build must roll its pages, sections, and variables back.
  await expect
    .poll(async () => {
      const state = await documentState()
      return state.preparing ? null : state
    })
    .toEqual({ ...pristine, preparing: false })
  canvas.assertNoErrors()
})

test('demo completion preserves a document replaced during its final page switch', async ({
  page
}) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const fixtureURL = '/tests/helpers/canvas/demo-startup.ts'
    const { replaceGraphDuringDemoSwitch }: typeof DemoStartup = await import(fixtureURL)
    return replaceGraphDuringDemoSwitch(store)
  })
  expect(result.actual).toEqual(result.expected)
  canvas.assertNoErrors()
})

test('demo tokens and main-component edits survive undo', async ({ page }) => {
  await openDemo(page)
  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const graph = store.graph
    const token = graph.variables.get('announcement-accent')
    if (!token) throw new Error('Accent token unavailable')
    const original = structuredClone(token.valuesByMode.default)
    store.updateVariableValue(token.id, 'default', { r: 0.05, g: 0.55, b: 0.5, a: 1 })
    const changed = structuredClone(token.valuesByMode.default)
    store.undoAction()
    const restored = structuredClone(token.valuesByMode.default)
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
