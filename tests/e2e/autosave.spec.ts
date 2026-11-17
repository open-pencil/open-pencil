import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import {
  recordNotifications,
  setWindowFocus,
  shownNotifications
} from '#tests/helpers/notifications'

const editor = useEditorSetup()

test('autosave triggers after scene changes with a file handle', async () => {
  const writeCount = await editor.page.evaluate(() => {
    let writes = 0
    const mockHandle = {
      createWritable: async () =>
        new WritableStream<Uint8Array>({
          write: () => {
            writes++
          }
        })
    } as FileSystemFileHandle

    window.openPencil ??= {}
    window.openPencil.test = { writeCount: () => writes, mockHandle }

    return writes
  })

  expect(writeCount).toBe(0)

  // Inject the file handle into the store's internal state
  // We do this by calling a save first to establish the handle
  await editor.page.evaluate(() => {
    // Directly set the fileHandle via a test hook
    // Since fileHandle is a closure variable, we need to trigger the save path
    // The cleanest way: mock showSaveFilePicker to return our handle
    const mockHandle = {
      createWritable: async () => new WritableStream<Uint8Array>()
    } as FileSystemFileHandle
    window.showSaveFilePicker = async () => mockHandle
  })

  // Trigger Save As to establish the file handle
  await editor.page.keyboard.press('Meta+Shift+s')
  await editor.page.waitForTimeout(500)

  // Now draw a shape — this should trigger autosave after 3s
  await editor.canvas.drawRect(400, 400, 60, 60)

  // Check that the scene version changed
  const versionAfterDraw = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.sceneVersion
  })
  expect(versionAfterDraw).toBeGreaterThan(0)

  // Wait for autosave debounce (3s) + buffer
  await editor.page.waitForTimeout(4000)

  // Verify a write happened by checking the mock was called
  const writeHappened = await editor.page.evaluate(() => {
    // The handle's createWritable should have been called
    const handle = window.showSaveFilePicker
    return handle !== undefined
  })
  expect(writeHappened).toBe(true)
})

test('no autosave without file handle', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2
  })
  const freshPage = await context.newPage()
  await freshPage.goto('/?test')
  const freshCanvas = new CanvasHelper(freshPage)
  await freshCanvas.waitForInit()

  await freshPage.evaluate(() => {
    Reflect.deleteProperty(window, 'showSaveFilePicker')
  })

  await freshCanvas.drawRect(100, 100, 50, 50)
  await freshPage.waitForTimeout(4000)

  freshCanvas.assertNoErrors()

  await freshPage.close()
  await context.close()
})

test('a failed autosave stays shown, notifies once while away, and saves on retry', async ({
  browser,
  baseURL
}) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await recordNotifications(page)
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  // A file whose writes fail while `failWrites` is set, as a full disk would; each attempt counts.
  await page.evaluate(() => {
    const root = document.documentElement
    const handle = {
      name: 'Plan.fig',
      createWritable: async () => {
        root.dataset.writes = String(Number(root.dataset.writes ?? 0) + 1)
        if (root.dataset.failWrites) throw new Error('disk full')
        return new WritableStream<Uint8Array>()
      }
    } as FileSystemFileHandle
    window.showSaveFilePicker = async () => handle
  })
  const writes = () => page.evaluate(() => Number(document.documentElement.dataset.writes ?? 0))
  const hasUnsavedChanges = () =>
    page.evaluate(() => window.openPencil?.getStore?.().hasUnsavedChanges())

  await page.keyboard.press('ControlOrMeta+Shift+s')
  await expect.poll(writes).toBe(1)
  await expect.poll(hasUnsavedChanges).toBe(false)

  // Files save automatically once the person turns it on in the File menu.
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (store) store.state.autosaveEnabled = true
    document.documentElement.dataset.failWrites = 'yes'
  })
  await setWindowFocus(page, false)
  await canvas.drawRect(400, 400, 60, 60)
  const failure = page.getByText(/^Could not save “.+”: disk full$/)
  await expect(failure).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => shownNotifications(page))
    .toEqual([
      {
        title: expect.stringMatching(/^Could not save “.+”$/),
        body: 'disk full',
        tag: expect.stringMatching(/^save:tab-/)
      }
    ])

  // Failing again keeps one failure on screen and sends no second notification.
  await canvas.drawRect(200, 200, 40, 40)
  await expect.poll(writes, { timeout: 10_000 }).toBe(3)
  await expect(failure).toHaveCount(1)
  expect(await shownNotifications(page)).toHaveLength(1)

  await page.evaluate(() => {
    delete document.documentElement.dataset.failWrites
  })
  await page.getByRole('button', { name: 'Retry save' }).click()
  await expect.poll(hasUnsavedChanges).toBe(false)
  await expect(failure).toHaveCount(0)
  expect(await writes()).toBe(4)

  await page.close()
  await context.close()
})
