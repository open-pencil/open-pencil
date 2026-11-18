import { expectDefined } from '@open-pencil/test-support/assert'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

// A host refuses the gesture in progress with `cancelGesture()`: the canvas undoes the drag as
// Escape does, and the release that follows changes nothing.
test('a move the host cancels mid-drag goes back and leaves no new step', async ({ page }) => {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.drawRect(100, 100, 120, 80)
  await canvas.pressKey('v')
  const read = () =>
    page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      const [id] = store?.state.selectedIds ?? []
      const node = id ? store?.graph.getNode(id) : undefined
      return { x: node?.x, y: node?.y, undo: store?.undo.undoLabel }
    })
  const before = await read()

  const box = expectDefined(await page.getByTestId('canvas-area').boundingBox(), 'canvas bounds')
  await page.mouse.move(box.x + 160, box.y + 140)
  await page.mouse.down()
  await page.mouse.move(box.x + 200, box.y + 170, { steps: 5 })
  expect((await read()).x).not.toBe(before.x)
  await page.evaluate(() => window.openPencil?.getStore?.().cancelGesture())
  await page.mouse.move(box.x + 240, box.y + 200, { steps: 5 })
  await page.mouse.up()

  expect(await read()).toEqual(before)
  canvas.assertNoErrors()
})
