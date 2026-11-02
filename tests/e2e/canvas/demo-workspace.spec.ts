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

async function setAppTheme(page: Page, theme: 'dark' | 'light') {
  await page.evaluate(async (value) => {
    const themeModulePath = '/src/app/shell/theme.ts'
    const themeModule = await import(themeModulePath)
    themeModule.useAppTheme().setTheme(value)
  }, theme)
  await page.waitForFunction((value) => document.documentElement.dataset.theme === value, theme)
}

test.use({ viewport: { width: 1200, height: 900 } })

test('the tour opens on its first chapter, the rest below it', async ({ page }) => {
  const canvas = await openDemo(page)
  const opened = await page.evaluate(() => {
    const store = window.lawha?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const pageId = store.state.currentPageId
    const sections = store.graph
      .getChildren(pageId)
      .filter((node) => node.type === 'SECTION')
      .sort((a, b) => a.y - b.y)
    const [first] = sections
    return {
      name: store.state.documentName,
      pages: store.graph.getPages().map((item) => item.name),
      chapters: sections.map((section) => section.name),
      unsaved: store.hasUnsavedChanges(),
      first: {
        x: first.x * store.state.zoom + store.state.panX,
        y: first.y * store.state.zoom + store.state.panY,
        width: first.width * store.state.zoom,
        height: first.height * store.state.zoom
      }
    }
  })
  expect(opened).toMatchObject({
    name: 'Demo',
    pages: ['Tour'],
    chapters: [
      '1 · Hello',
      '2 · Slots',
      '3 · Controls',
      '4 · Modes',
      '5 · Shaders',
      '6 · Code',
      '7 · Lint',
      '8 · Yours'
    ],
    unsaved: false
  })
  const box = await canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas unavailable')
  expect(opened.first.x).toBeGreaterThanOrEqual(0)
  expect(opened.first.y).toBeGreaterThanOrEqual(0)
  expect(opened.first.x + opened.first.width).toBeLessThanOrEqual(box.width)
  expect(opened.first.y + opened.first.height).toBeLessThanOrEqual(box.height)
  await canvas.waitForRender()
  canvas.assertNoErrors()
  expect(await canvas.screenshotCanvasRegion(1200, 900)).toMatchSnapshot('demo-tour-dark.png', {
    maxDiffPixels: 100
  })
})

test('the tour follows the app theme without becoming an edit', async ({ page }) => {
  const canvas = await openDemo(page)
  const read = () =>
    page.evaluate(() => {
      const store = window.lawha?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const pageId = store.state.currentPageId
      const modeOf = (name: string) => {
        const collection = [...store.graph.variableCollections.values()].find(
          (item) => item.name === name
        )
        const modeId = collection && store.graph.getNodeVariableModeId(pageId, collection.id)
        return collection?.modes.find((mode) => mode.modeId === modeId)?.name
      }
      return {
        theme: modeOf('Theme'),
        chrome: modeOf('App chrome'),
        page: store.state.pageColor,
        unsaved: store.hasUnsavedChanges(),
        undo: store.undo.canUndo
      }
    })
  await setAppTheme(page, 'light')
  await expect.poll(async () => (await read()).theme).toBe('Light')
  const light = await read()
  expect(light).toMatchObject({ chrome: 'Light', unsaved: false, undo: false })
  expect(light.page.r).toBeGreaterThan(0.9)
  await canvas.waitForRender()
  expect(await canvas.screenshotCanvasRegion(1200, 900)).toMatchSnapshot('demo-tour-light.png', {
    maxDiffPixels: 100
  })

  await setAppTheme(page, 'dark')
  await expect.poll(async () => (await read()).theme).toBe('Dark')
  expect((await read()).page.r).toBeLessThan(0.1)
})

test('tour tokens and main-component edits survive undo', async ({ page }) => {
  await openDemo(page)
  const result = await page.evaluate(async () => {
    const store = window.lawha?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const graph = store.graph
    // The tour is opened from `.fig`, which gives variables and modes ids of its own.
    const collection = [...graph.variableCollections.values()].find((item) => item.name === 'Theme')
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
      (node) => node.type === 'COMPONENT' && node.name === 'Player'
    )
    if (!component) throw new Error('Player component unavailable')
    const artist = (owner: string) => {
      const track = graph.getChildren(owner).find((node) => node.name === 'Track')
      return track && graph.getChildren(track.id).find((node) => node.name === 'Artist')
    }
    const headline = artist(component.id)
    if (!headline) throw new Error('Artist text unavailable')
    // Instances that leave Artist at the component's value follow its edits.
    const following = Array.from(graph.getAllNodes()).filter(
      (node) =>
        node.type === 'INSTANCE' &&
        node.componentId === component.id &&
        Object.keys(node.componentPropertyAssignments).length === 0
    )
    const artists = () => following.map((instance) => artist(instance.id)?.text)
    store.updateNodeWithUndo(headline.id, { text: 'Lumen & friends' }, 'Edit tour artist')
    await store.loadFontsForNodes([component.id])
    const edited = artists()
    store.undoAction()
    await store.loadFontsForNodes([component.id])
    return { original, changed, restored, count: following.length, edited, reverted: artists() }
  })
  expect(result.changed).not.toEqual(result.original)
  expect(result.restored).toEqual(result.original)
  expect(result.count).toBeGreaterThan(1)
  expect(new Set(result.edited)).toEqual(new Set(['Lumen & friends']))
  expect(new Set(result.reverted)).toEqual(new Set(['Lumen']))
})
