import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetup()

test('layers panel resize increases width', async () => {
  const panel = editor.page.getByTestId('layers-panel')
  const before = await panel.boundingBox()
  expect(before).not.toBeNull()

  const handle = editor.page.getByTestId('left-splitter-handle')
  const handleBox = await handle.boundingBox()
  expect(handleBox).not.toBeNull()

  const handleBounds = expectDefined(handleBox, 'splitter handle bounds')
  const beforeBounds = expectDefined(before, 'layers panel bounds')
  const cx = handleBounds.x + handleBounds.width / 2
  const cy = handleBounds.y + handleBounds.height / 2

  await editor.page.mouse.move(cx, cy)
  await editor.page.mouse.down()
  await editor.page.mouse.move(cx + 80, cy, { steps: 10 })
  await editor.page.mouse.up()
  await editor.canvas.waitForRender()

  const after = expectDefined(await panel.boundingBox(), 'resized layers panel bounds')
  expect(after.width).toBeGreaterThan(beforeBounds.width + 40)
  editor.canvas.assertNoErrors()
})

test('panel width persists after page reload', async () => {
  // Allow Reka's auto-save debounce to flush before recording the width
  await editor.page.waitForTimeout(300)
  const recordedWidth = expectDefined(
    await editor.page.getByTestId('layers-panel').boundingBox(),
    'persisted layers panel bounds'
  ).width

  await editor.page.reload()
  await editor.canvas.waitForInit()

  const after = expectDefined(
    await editor.page.getByTestId('layers-panel').boundingBox(),
    'reloaded layers panel bounds'
  )
  expect(Math.abs(after.width - recordedWidth)).toBeLessThanOrEqual(2)
  editor.canvas.assertNoErrors()
})

test('Cmd+Backslash hides panels', async () => {
  await editor.page.keyboard.press('Meta+\\')
  await editor.canvas.waitForRender()

  await expect(editor.page.getByTestId('layers-panel')).not.toBeVisible()
  editor.canvas.assertNoErrors()
})

test('Cmd+Backslash shows panels again', async () => {
  await editor.page.keyboard.press('Meta+\\')
  await editor.canvas.waitForRender()

  await expect(editor.page.getByTestId('layers-panel')).toBeVisible()
  editor.canvas.assertNoErrors()
})

// The right panel opens at one width on any window, rather than as a share that grows with it.
test('the properties panel opens at the same width on a narrow and a wide window', async ({
  browser,
  baseURL
}) => {
  const widths: number[] = []
  for (const width of [1280, 1920]) {
    const context = await browser.newContext({ baseURL, viewport: { width, height: 900 } })
    try {
      const page = await context.newPage()
      await page.goto('/?test')
      const panel = page.getByTestId('properties-panel')
      await expect(panel).toBeVisible()
      widths.push(expectDefined(await panel.boundingBox(), 'properties panel bounds').width)
    } finally {
      await context.close()
    }
  }
  expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(1)
  expect(widths[0]).toBeGreaterThan(240)
  expect(widths[0]).toBeLessThan(270)
})
