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
test('the properties panel reopens at one width on a narrow and a wide window', async ({
  browser,
  baseURL
}) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } })
  try {
    const page = await context.newPage()
    const panel = page.getByTestId('properties-panel')
    const panelWidth = async () =>
      expectDefined(await panel.boundingBox(), 'properties panel bounds').width

    await page.goto('/?test')
    await expect(panel).toBeVisible()
    const narrow = await panelWidth()
    expect(narrow).toBeGreaterThan(240)
    expect(narrow).toBeLessThan(270)

    // Neither pressing a handle without moving it nor hiding and showing the panels resizes them.
    const handle = expectDefined(
      await page.getByTestId('right-splitter-handle').boundingBox(),
      'right splitter handle bounds'
    )
    await page.mouse.click(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.keyboard.press('Meta+\\')
    await page.keyboard.press('Meta+\\')
    await expect(panel).toBeVisible()

    // A fixed width is a repeating share of 1920 px; saved, it would reopen narrower at 1280 px.
    for (const width of [1920, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await page.reload()
      await expect(panel).toBeVisible()
      expect(Math.abs((await panelWidth()) - narrow)).toBeLessThanOrEqual(1)
    }
  } finally {
    await context.close()
  }
})

test('a keyboard resize survives a reload and hiding the panels', async () => {
  const panel = editor.page.getByTestId('layers-panel')
  const panelWidth = async () =>
    expectDefined(await panel.boundingBox(), 'layers panel bounds').width
  const before = await panelWidth()

  await editor.page.getByTestId('left-splitter-handle').focus()
  await editor.page.keyboard.press('ArrowRight')
  const resized = await panelWidth()
  expect(resized).toBeGreaterThan(before + 2)

  await editor.page.reload()
  await editor.canvas.waitForInit()
  expect(Math.abs((await panelWidth()) - resized)).toBeLessThanOrEqual(1)

  await editor.page.keyboard.press('Meta+\\')
  await editor.page.keyboard.press('Meta+\\')
  await expect(panel).toBeVisible()
  expect(Math.abs((await panelWidth()) - resized)).toBeLessThanOrEqual(1)
  editor.canvas.assertNoErrors()
})
