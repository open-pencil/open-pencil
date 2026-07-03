import { test, expect, type Page } from '@playwright/test'

import { expectInViewport } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 100, 100)
})

test.afterAll(async () => {
  await page.close()
})

function exportItems() {
  return page.getByTestId('export-item')
}

function exportButton() {
  return page.getByTestId('export-button')
}

async function createRectangles(count: number, settings: unknown[][] = []) {
  const ids = await page.evaluate(
    ({ count: nodeCount, settingsByNode }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      for (const node of store.graph.getChildren(store.state.currentPageId)) {
        store.graph.deleteNode(node.id)
      }
      const ids: string[] = []
      for (let i = 0; i < nodeCount; i++) {
        const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
          name: `Export rect ${i + 1}`,
          x: 100 + i * 140,
          y: 100,
          width: 100,
          height: 100,
          exportSettings: settingsByNode[i] ?? []
        })
        ids.push(node.id)
      }
      store.select(ids)
      store.requestRender()
      return ids
    },
    { count, settingsByNode: settings }
  )
  await canvas.waitForRender()
  return ids
}

async function selectedExportSettings() {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds].map((id) => store.graph.getNode(id)?.exportSettings ?? [])
  })
}

test('new selection starts with empty export settings', async () => {
  await createRectangles(1)

  await expect(exportItems()).toHaveCount(0)
  await expect(exportButton()).toHaveCount(0)
  await expect(page.getByTestId('export-preview-toggle')).toHaveCount(0)
  canvas.assertNoErrors()
})

test('add export row increases row count', async () => {
  const before = await exportItems().count()

  await page.getByTestId('export-section-add').click()
  await canvas.waitForRender()

  const after = await exportItems().count()
  expect(after).toBe(before + 1)
  await expect(exportButton()).toContainText('Export rect 1')
  canvas.assertNoErrors()
})

test('remove export row decreases row count', async () => {
  await page.getByTestId('export-section-add').click()
  await canvas.waitForRender()

  const before = await exportItems().count()
  await exportItems().first().locator('button').last().click()
  await canvas.waitForRender()

  const after = await exportItems().count()
  expect(after).toBe(before - 1)
  canvas.assertNoErrors()
})

test('format selector changes to JPG', async () => {
  const formatTrigger = exportItems().first().getByTestId('app-select-trigger').last()
  await expect(formatTrigger).toHaveAttribute('aria-label', 'Export format')
  await formatTrigger.click()

  for (const label of ['PNG', 'JPG', 'WEBP', 'SVG', 'PDF']) {
    await expect(page.locator('[role="option"]').filter({ hasText: label })).toBeVisible()
  }

  const jpgOption = page.locator('[role="option"]').filter({ hasText: 'JPG' })
  await expectInViewport(page, jpgOption)
  await jpgOption.click()
  await canvas.waitForRender()

  await expect(formatTrigger).toHaveText('JPG')
  canvas.assertNoErrors()
})

test('format selector does not offer FIG as an export format', async () => {
  const formatTrigger = exportItems().first().getByTestId('app-select-trigger').last()
  await formatTrigger.click()

  await expect(page.locator('[role="option"]').filter({ hasText: '.fig' })).toHaveCount(0)
  await page.locator('[role="option"]').filter({ hasText: 'JPG' }).click()
  canvas.assertNoErrors()
})

test('SVG format hides scale selector', async () => {
  const formatTrigger = exportItems().first().getByTestId('app-select-trigger').last()
  await formatTrigger.click()

  await page.locator('[role="option"]').filter({ hasText: 'SVG' }).click()
  await canvas.waitForRender()

  const selects = exportItems().first().getByTestId('app-select-trigger')
  await expect(selects).toHaveCount(1)
  canvas.assertNoErrors()
})

test('format selector works with multiple export rows', async () => {
  await createRectangles(1, [
    [
      { scale: 1, format: 'png' },
      { scale: 1, format: 'svg' }
    ]
  ])

  const firstRowFormat = exportItems().nth(0).getByTestId('app-select-trigger').last()
  await firstRowFormat.click()
  await page.locator('[role="option"]').filter({ hasText: 'JPG' }).click()
  await canvas.waitForRender()

  const secondRowFormat = exportItems().nth(1).getByTestId('app-select-trigger').last()
  await secondRowFormat.click()
  await page.locator('[role="option"]').filter({ hasText: 'PDF' }).click()
  await canvas.waitForRender()

  expect(await selectedExportSettings()).toEqual([
    [
      { scale: 1, format: 'jpg' },
      { scale: 1, format: 'pdf' }
    ]
  ])
  canvas.assertNoErrors()
})

// The app prefers the File System Access save dialog when available, which never
// resolves in a headless browser. Unset it so the export falls back to the
// anchor-download path, which Playwright can capture as a `download` event.
async function forceBlobDownload() {
  await page.evaluate(() => {
    window.showSaveFilePicker = undefined
  })
}

// `createRectangles` makes fill-less rectangles, which have no visual bounds and
// export to nothing. Use createShape so the rectangle has a real fill and is
// actually exportable, then attach the export settings under test.
async function createExportableRect(settings: { scale: number; format: string }[]) {
  await page.evaluate((nodeSettings) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    for (const node of store.graph.getChildren(store.state.currentPageId)) {
      store.graph.deleteNode(node.id)
    }
    const id = store.createShape('RECTANGLE', 100, 100, 100, 100)
    store.graph.updateNode(id, { name: 'Export rect 1', exportSettings: nodeSettings })
    store.select([id])
    store.requestRender()
  }, settings)
  await canvas.waitForRender()
}

test('multiple export formats download as a single zip', async () => {
  await createExportableRect([
    { scale: 1, format: 'png' },
    { scale: 1, format: 'svg' }
  ])
  await forceBlobDownload()

  const [download] = await Promise.all([page.waitForEvent('download'), exportButton().click()])
  expect(download.suggestedFilename()).toBe('Export rect 1.zip')
  canvas.assertNoErrors()
})

test('a single export format downloads the file directly', async () => {
  await createExportableRect([{ scale: 1, format: 'png' }])
  await forceBlobDownload()

  const [download] = await Promise.all([page.waitForEvent('download'), exportButton().click()])
  expect(download.suggestedFilename()).toBe('Export rect 1@1x.png')
  canvas.assertNoErrors()
})

test('preview toggle shows image with blob src', async () => {
  const formatTrigger = exportItems().first().getByTestId('app-select-trigger').last()
  await formatTrigger.click()
  await page.locator('[role="option"]').filter({ hasText: 'PNG' }).click()
  await canvas.waitForRender()

  await page.getByTestId('export-preview-toggle').click()

  const img = page.getByTestId('export-section').locator('img')
  await expect(img).toBeVisible({ timeout: 10000 })

  const src = await img.getAttribute('src')
  expect(src).toMatch(/^blob:/)
  canvas.assertNoErrors()
})

test('multi-select add and edit applies to all selected layers', async () => {
  await createRectangles(2)

  await page.getByTestId('export-section-add').click()
  await canvas.waitForRender()

  await expect(exportButton()).toContainText('Export 2 layers')
  expect(await selectedExportSettings()).toEqual([
    [{ scale: 1, format: 'png' }],
    [{ scale: 1, format: 'png' }]
  ])

  const scaleInput = exportItems().first().getByTestId('export-scale-input')
  await scaleInput.fill('2.5x')
  await scaleInput.press('Enter')
  await canvas.waitForRender()

  expect(await selectedExportSettings()).toEqual([
    [{ scale: 2.5, format: 'png' }],
    [{ scale: 2.5, format: 'png' }]
  ])
  canvas.assertNoErrors()
})

test('mixed export settings are indicated', async () => {
  await createRectangles(2, [[{ scale: 1, format: 'png' }], [{ scale: 2, format: 'jpg' }]])

  await expect(page.getByTestId('export-section')).toContainText('Mixed')
  canvas.assertNoErrors()
})

test('undo reverts export setting edits', async () => {
  await createRectangles(2)

  await page.getByTestId('export-section-add').click()
  await canvas.waitForRender()
  expect(await selectedExportSettings()).toEqual([
    [{ scale: 1, format: 'png' }],
    [{ scale: 1, format: 'png' }]
  ])

  await canvas.undo()

  expect(await selectedExportSettings()).toEqual([[], []])
  await expect(exportItems()).toHaveCount(0)
  canvas.assertNoErrors()
})
