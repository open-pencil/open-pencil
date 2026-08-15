import type { Page } from '@playwright/test'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

type PageChildSummary = {
  name: string
  type: string
}

async function installTauriClipboardMock(page: Page) {
  await page.addInitScript(() => {
    const state = {
      text: '',
      html: '',
      failHtmlWrites: false,
      writes: [] as Array<{ cmd: string; args: unknown }>
    }

    Object.defineProperty(window, '__OPENPENCIL_TEST_CLIPBOARD__', {
      configurable: true,
      value: state
    })

    let callbackId = 1
    const callbacks = new Map<number, unknown>()

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {
        callbacks,
        metadata: {
          currentWindow: { label: 'main' },
          currentWebview: { label: 'main' }
        },
        convertFileSrc: (filePath: string) => filePath,
        invoke: async (cmd: string, args?: Record<string, unknown>) => {
          state.writes.push({ cmd, args })
          switch (cmd) {
            case 'plugin:clipboard-manager|write_html': {
              if (state.failHtmlWrites) throw new Error('Clipboard write failed')
              state.html = String(args?.html ?? '')
              state.text = String(args?.altText ?? state.html)
              return null
            }
            case 'plugin:clipboard-manager|write_text': {
              state.text = String(args?.text ?? '')
              state.html = ''
              return null
            }
            case 'plugin:clipboard-manager|read_text':
              return state.html || state.text
            case 'list_system_fonts':
            case 'take_pending_open':
              return []
            case 'load_system_font':
              return null
            case 'plugin:event|listen':
            case 'plugin:event|unlisten':
            case 'plugin:process|exit':
            case 'plugin:process|restart':
              return null
            default:
              return null
          }
        },
        transformCallback: (callback: unknown) => {
          const id = callbackId++
          callbacks.set(id, callback)
          return id
        },
        unregisterCallback: (id: number) => {
          callbacks.delete(id)
        },
        runCallback: () => null
      }
    })
  })
}

async function createTauriEditorPage(page: Page) {
  await installTauriClipboardMock(page)
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  return canvas
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

function testClipboard(page: Page) {
  return page.evaluate(() => window.__OPENPENCIL_TEST_CLIPBOARD__)
}

function failTauriHTMLWrites(page: Page) {
  return page.evaluate(() => {
    window.__OPENPENCIL_TEST_CLIPBOARD__.failHtmlWrites = true
  })
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
  const canvas = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)

  await dispatchClipboardEvent(page, 'copy')

  await expect
    .poll(() => testClipboard(page))
    .toMatchObject({
      text: 'Rectangle'
    })
  const clipboard = await testClipboard(page)
  expect(clipboard.html).toContain('(figma)')
  expect(
    clipboard.writes.some((entry) => entry.cmd === 'plugin:clipboard-manager|write_html')
  ).toBe(true)
  await expect(page.getByText('Clipboard access is blocked in this browser context')).toHaveCount(0)
  canvas.assertNoErrors()
})

test('Tauri paste restores copied design data from plugin clipboard text', async ({ page }) => {
  const canvas = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)
  await dispatchClipboardEvent(page, 'copy')
  await expect.poll(() => testClipboard(page)).toMatchObject({ text: 'Rectangle' })

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
  const canvas = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)

  await dispatchClipboardEvent(page, 'cut')
  await canvas.waitForRender()

  await expect.poll(() => pageChildren(page)).toEqual([])
  const clipboard = await testClipboard(page)
  expect(clipboard.html).toContain('(figma)')
  expect(clipboard.text).toBe('Rectangle')
  await expect(page.getByText('Clipboard access is blocked in this browser context')).toHaveCount(0)
  canvas.assertNoErrors()
})

test('Tauri cut keeps the selection when the clipboard write fails', async ({ page }) => {
  const canvas = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)
  await failTauriHTMLWrites(page)

  await dispatchClipboardEvent(page, 'cut')
  await canvas.waitForRender()

  await expect.poll(() => pageChildren(page)).toEqual([{ name: 'Rectangle', type: 'RECTANGLE' }])
  expect(await selectedCount(page)).toBe(1)
  const clipboard = await testClipboard(page)
  expect(clipboard.html).toBe('')
  expect(clipboard.text).toBe('')
  expect(
    clipboard.writes.some((entry) => entry.cmd === 'plugin:clipboard-manager|write_html')
  ).toBe(true)
  canvas.assertNoErrors()
})

test('Tauri clipboard events from editable fields keep native text behavior', async ({ page }) => {
  const canvas = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)
  const before = await testClipboard(page)

  await page.evaluate(() => {
    const host = document.createElement('div')
    host.innerHTML =
      '<input data-clipboard-probe="input"><textarea data-clipboard-probe="textarea"></textarea><div contenteditable="true"><span>Text</span></div>'
    document.body.append(host)
  })

  await dispatchClipboardEvent(page, 'copy', '[data-clipboard-probe="input"]')
  expect(await testClipboard(page)).toEqual(before)
  await dispatchClipboardEvent(page, 'copy', '[data-clipboard-probe="textarea"]')
  expect(await testClipboard(page)).toEqual(before)
  await dispatchClipboardEvent(page, 'cut', '[contenteditable] span')
  expect(await testClipboard(page)).toEqual(before)
  await dispatchClipboardEvent(page, 'paste', '[contenteditable] span')

  expect(await testClipboard(page)).toEqual(before)
  expect(await pageChildren(page)).toHaveLength(1)
})

test('Tauri context-menu copy uses plugin clipboard fallback instead of blocked browser command', async ({
  page
}) => {
  const canvas = await createTauriEditorPage(page)
  await canvas.drawRect(160, 160, 96, 72)

  const box = await canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')
  await page.mouse.click(box.x + 190, box.y + 190, { button: 'right' })
  await page.getByTestId('context-copy').click()

  await expect.poll(() => testClipboard(page)).toMatchObject({ text: 'Rectangle' })
  await expect(page.getByText('Clipboard access is blocked in this browser context')).toHaveCount(0)
  canvas.assertNoErrors()
})
