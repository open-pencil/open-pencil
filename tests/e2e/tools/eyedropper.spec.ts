import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { eyedropperDriver } from '#tests/helpers/canvas/eyedropper-driver'
import { getSelectedNode } from '#tests/helpers/store'

const editor = useEditorSetupWithClear('/?test')
const eyedropper = eyedropperDriver(() => editor.page)

const SOURCE = { r: 1, g: 0, b: 0, a: 1 }
const TARGET = { r: 0.2, g: 0.4, b: 0.8, a: 1 }

/** A red source rectangle left of a blue target rectangle; the target ends up selected. */
async function sourceAndTarget() {
  const { canvas } = editor
  await canvas.drawRect(100, 120, 100, 100)
  const source = await eyedropper.selectedId()
  if (!source) throw new Error('Drawing the source rectangle selected nothing')
  await eyedropper.setFill(source, SOURCE)
  await canvas.drawRect(300, 120, 100, 100)
  const target = await eyedropper.selectedId()
  if (!target) throw new Error('Drawing the target rectangle selected nothing')
  await eyedropper.setFill(target, TARGET)
  return target
}

test('I then a click paints the selection with the sampled color in one undo step', async () => {
  const { canvas } = editor
  const target = await sourceAndTarget()

  await canvas.pressKey('i')
  await canvas.click(150, 170)
  await expect.poll(() => eyedropper.topPaint(target, 'fills')).toEqual({ color: SOURCE })
  expect(await eyedropper.selectedId()).toBe(target)
  expect(await eyedropper.activeTool()).toBe('SELECT')

  await canvas.undo()
  await expect.poll(() => eyedropper.topPaint(target, 'fills')).toEqual({ color: TARGET })
})

test('hovering shows the loupe with the color a click picks, until the pointer leaves', async () => {
  const { page, canvas } = editor
  await sourceAndTarget()
  const loupe = page.getByTestId('eyedropper-loupe')

  await canvas.pressKey('i')
  await canvas.hover(150, 170)
  await expect(loupe).toBeVisible()
  await expect(page.getByTestId('eyedropper-loupe-value')).toHaveText('FF0000')

  await page.mouse.move(0, 0)
  await expect(loupe).toBeHidden()
  await canvas.hover(150, 170)
  await expect(loupe).toBeVisible()
  await canvas.pressKey('Escape')
  await expect(loupe).toBeHidden()
})

test('Alt-click samples into the stroke and keeps the fill', async () => {
  const { page, canvas } = editor
  const target = await sourceAndTarget()

  await canvas.pressKey('i')
  await page.keyboard.down('Alt')
  await canvas.click(150, 170)
  await page.keyboard.up('Alt')

  await expect.poll(() => eyedropper.topPaint(target, 'strokes')).toEqual({ color: SOURCE })
  expect(await eyedropper.topPaint(target, 'fills')).toEqual({ color: TARGET })
})

test('Escape leaves the eyedropper without changing the selection', async () => {
  const { canvas } = editor
  const target = await sourceAndTarget()

  await canvas.pressKey('i')
  await canvas.pressKey('Escape')
  // With the Move tool back, the same click selects the source rectangle instead of sampling it.
  await canvas.click(150, 170)
  await expect.poll(() => eyedropper.selectedId()).not.toBe(target)
  expect(await eyedropper.topPaint(target, 'fills')).toEqual({ color: TARGET })
})

test('I types a letter while editing text', async () => {
  const { page, canvas } = editor
  await canvas.pressKey('t')
  await canvas.click(200, 300)
  await page.keyboard.type('AIB')
  await canvas.pressKey('Escape')

  expect((await getSelectedNode(page))?.text).toBe('AIB')
})

test('the color picker button samples the canvas and the picker stays open', async () => {
  const { page, canvas } = editor
  const target = await sourceAndTarget()

  await page.getByTestId('fill-picker-swatch').first().click()
  const pick = page.getByTestId('color-eyedropper')
  await pick.click()
  await expect(pick).toHaveAttribute('aria-pressed', 'true')
  await canvas.hover(150, 170)
  await expect(page.getByTestId('eyedropper-loupe')).toBeVisible()
  await canvas.click(150, 170)

  await expect.poll(() => eyedropper.topPaint(target, 'fills')).toEqual({ color: SOURCE })
  await expect(pick).toBeVisible()
  await expect(pick).toHaveAttribute('aria-pressed', 'false')
  expect(await eyedropper.activeTool()).toBe('SELECT')
})

test('a color sampled into the picker undoes and redoes as one step', async () => {
  const { page, canvas } = editor
  const target = await sourceAndTarget()

  await page.getByTestId('fill-picker-swatch').first().click()
  await page.getByTestId('color-eyedropper').click()
  await canvas.click(150, 170)
  await expect.poll(() => eyedropper.topPaint(target, 'fills')).toEqual({ color: SOURCE })

  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => eyedropper.topPaint(target, 'fills')).toEqual({ color: TARGET })
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(() => eyedropper.topPaint(target, 'fills')).toEqual({ color: SOURCE })
  await expect(page.getByTestId('color-eyedropper')).toBeVisible()
})

test('pressing the picker button again stops sampling', async () => {
  const { page, canvas } = editor
  const target = await sourceAndTarget()

  await page.getByTestId('fill-picker-swatch').first().click()
  const pick = page.getByTestId('color-eyedropper')
  await pick.click()
  await expect(pick).toHaveAttribute('aria-pressed', 'true')
  await pick.click()

  await expect(pick).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => eyedropper.activeTool()).toBe('SELECT')
  // The picker stays open, and the next canvas click samples nothing.
  await expect(pick).toBeVisible()
  await canvas.click(150, 170)
  expect(await eyedropper.topPaint(target, 'fills')).toEqual({ color: TARGET })
})

test('closing the picker while it samples leaves the eyedropper', async () => {
  const { page, canvas } = editor
  const target = await sourceAndTarget()

  await page.getByTestId('fill-picker-swatch').first().click()
  await page.getByTestId('color-eyedropper').click()
  await page.keyboard.press('Escape')

  await expect(page.getByTestId('color-eyedropper')).toBeHidden()
  await expect.poll(() => eyedropper.activeTool()).toBe('SELECT')
  // The next click selects as usual instead of answering a request no picker waits on.
  await canvas.click(150, 170)
  await expect.poll(() => eyedropper.selectedId()).not.toBe(target)
  expect(await eyedropper.topPaint(target, 'fills')).toEqual({ color: TARGET })
})
