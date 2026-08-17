import type { Page } from '@playwright/test'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { installTauriClipboardMock } from '#tests/helpers/tauri/clipboard-mock'

type PageChildSummary = {
  name: string
  type: string
}

async function createTauriEditorPage(page: Page) {
  const clipboard = await installTauriClipboardMock(page)
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  return { canvas, clipboard }
}

function pageChildren(page: Page): Promise<PageChildSummary[]> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).map((node) => ({
      name: node.name,
      type: node.type
    }))
  })
}

function selectedCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.selectedIds.size
  })
}

async function selectProbeText(page: Page, selector: string) {
  await page.evaluate((probeSelector) => {
    const probe = document.querySelector(probeSelector)
    const selection = window.getSelection()
    if (!probe || !selection) throw new Error(`Text selection probe not found: ${probeSelector}`)
    const range = document.createRange()
    range.selectNodeContents(probe)
    selection.removeAllRanges()
    selection.addRange(range)
  }, selector)
}

async function dispatchClipboardEvent(
  page: Page,
  type: 'copy' | 'cut' | 'paste',
  target = 'window'
) {
  await page.evaluate(
    ({ eventType, selector }) => {
      const eventTarget = selector === 'window' ? window : document.querySelector(selector)
      if (!eventTarget) throw new Error(`Clipboard event target not found: ${selector}`)
      eventTarget.dispatchEvent(new ClipboardEvent(eventType, { bubbles: true, cancelable: true }))
    },
    { eventType: type, selector: target }
  )
}

test('Tauri copy writes selected design HTML without requiring ClipboardEvent.clipboardData', async ({
  page
}) => {
  const { canvas, clipboard } = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)

  await dispatchClipboardEvent(page, 'copy')

  await expect.poll(() => clipboard.snapshot()).toMatchObject({ text: 'Rectangle' })
  const snapshot = clipboard.snapshot()
  expect(snapshot.html).toContain('(figma)')
  expect(snapshot.writes.some((entry) => entry.cmd === 'plugin:clipboard-manager|write_html')).toBe(
    true
  )
  await expect(page.getByText('Clipboard access is blocked in this browser context')).toHaveCount(0)
  canvas.assertNoErrors()
})

test('Tauri paste restores copied design data from plugin clipboard text', async ({ page }) => {
  const { canvas, clipboard } = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)
  await dispatchClipboardEvent(page, 'copy')
  await expect.poll(() => clipboard.snapshot()).toMatchObject({ text: 'Rectangle' })

  expect(await pageChildren(page)).toHaveLength(1)
  await canvas.deleteSelection()
  expect(await pageChildren(page)).toHaveLength(0)

  await dispatchClipboardEvent(page, 'paste')
  await canvas.waitForRender()

  const children = await pageChildren(page)
  expect(children).toEqual([{ name: 'Rectangle', type: 'RECTANGLE' }])
  expect(await selectedCount(page)).toBe(1)
  await expect(page.getByText('Clipboard access is blocked in this browser context')).toHaveCount(0)
  canvas.assertNoErrors()
})

test('Tauri cut writes design data and deletes the selection', async ({ page }) => {
  const { canvas, clipboard } = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)

  await dispatchClipboardEvent(page, 'cut')
  await canvas.waitForRender()

  await expect.poll(() => pageChildren(page)).toEqual([])
  const snapshot = clipboard.snapshot()
  expect(snapshot.html).toContain('(figma)')
  expect(snapshot.text).toBe('Rectangle')
  await expect(page.getByText('Clipboard access is blocked in this browser context')).toHaveCount(0)
  canvas.assertNoErrors()
})

test('Tauri cut keeps the selection when the clipboard write fails', async ({ page }) => {
  const { canvas, clipboard } = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)
  clipboard.rejectHTMLWrites()

  await dispatchClipboardEvent(page, 'cut')
  await canvas.waitForRender()

  await expect.poll(() => pageChildren(page)).toEqual([{ name: 'Rectangle', type: 'RECTANGLE' }])
  expect(await selectedCount(page)).toBe(1)
  const snapshot = clipboard.snapshot()
  expect(snapshot.html).toBe('')
  expect(snapshot.text).toBe('')
  expect(snapshot.writes.some((entry) => entry.cmd === 'plugin:clipboard-manager|write_html')).toBe(
    true
  )
  canvas.assertNoErrors()
})

test('Tauri clipboard events from editable fields keep native text behavior', async ({ page }) => {
  const { canvas, clipboard } = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)
  const before = clipboard.snapshot()

  await page.evaluate(() => {
    const host = document.createElement('div')
    host.innerHTML =
      '<input data-clipboard-probe="input"><textarea data-clipboard-probe="textarea"></textarea><div contenteditable="true"><span>Text</span></div>'
    document.body.append(host)
  })

  await dispatchClipboardEvent(page, 'copy', '[data-clipboard-probe="input"]')
  expect(clipboard.snapshot()).toEqual(before)
  await dispatchClipboardEvent(page, 'copy', '[data-clipboard-probe="textarea"]')
  expect(clipboard.snapshot()).toEqual(before)
  await dispatchClipboardEvent(page, 'cut', '[contenteditable] span')
  expect(clipboard.snapshot()).toEqual(before)
  await dispatchClipboardEvent(page, 'paste', '[contenteditable] span')

  expect(clipboard.snapshot()).toEqual(before)
  expect(await pageChildren(page)).toHaveLength(1)
})

test('Tauri copy preserves selected document text instead of copying canvas layers', async ({
  page
}) => {
  const { canvas, clipboard } = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)
  const before = clipboard.snapshot()

  await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.className = 'select-text'
    probe.dataset.clipboardProbe = 'document-text'
    probe.textContent = 'Assistant response'
    document.body.append(probe)
  })
  await selectProbeText(page, '[data-clipboard-probe="document-text"]')
  expect(
    await page.evaluate(() => ({
      collapsed: window.getSelection()?.isCollapsed,
      text: window.getSelection()?.toString()
    }))
  ).toEqual({ collapsed: false, text: 'Assistant response' })
  await dispatchClipboardEvent(page, 'copy', '[data-clipboard-probe="document-text"]')

  expect(clipboard.snapshot()).toEqual(before)
  expect(await selectedCount(page)).toBe(1)
})

test('Tauri context-menu copy uses plugin clipboard fallback instead of blocked browser command', async ({
  page
}) => {
  const { canvas, clipboard } = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)

  const box = await canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')
  await page.mouse.click(box.x + 190, box.y + 190, { button: 'right' })
  await page.getByTestId('context-copy').click()

  await expect.poll(() => clipboard.snapshot()).toMatchObject({ text: 'Rectangle' })
  await expect(page.getByText('Clipboard access is blocked in this browser context')).toHaveCount(0)
  canvas.assertNoErrors()
})
