import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

/** The frame's box on the canvas, in screen pixels, and the canvas size. */
function frameOnScreen() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('openPencil store not available')
    const [id] = store.state.selectedIds
    const node = store.graph.getNode(id)
    if (!node) throw new Error('No frame selected')
    const { zoom, panX, panY } = store.state
    const canvas = document.querySelector('canvas')?.getBoundingClientRect()
    if (!canvas) throw new Error('No canvas')
    return {
      left: node.x * zoom + panX,
      top: node.y * zoom + panY,
      right: (node.x + node.width) * zoom + panX,
      bottom: (node.y + node.height) * zoom + panY,
      width: canvas.width,
      height: canvas.height,
      zoom
    }
  })
}

test('a preset frame too large for the canvas is zoomed out to, with room around it', async () => {
  await editor.canvas.pressKey('f')
  await editor.page.getByRole('button', { name: 'iPhone Air 420 × 912' }).click()
  await editor.canvas.waitForRender()

  const frame = await frameOnScreen()
  expect(frame.zoom).toBeLessThan(1)
  expect(frame.left).toBeGreaterThanOrEqual(40)
  expect(frame.top).toBeGreaterThanOrEqual(40)
  expect(frame.right).toBeLessThanOrEqual(frame.width - 40)
  expect(frame.bottom).toBeLessThanOrEqual(frame.height - 40)
  // Centered across the canvas.
  expect(Math.abs((frame.left + frame.right) / 2 - frame.width / 2)).toBeLessThan(30)
})

test('a preset frame that fits keeps the zoom', async () => {
  await editor.page.evaluate(() => window.openPencil?.getStore?.().zoomTo100())
  await editor.canvas.pressKey('f')
  await editor.page.getByRole('button', { name: 'Watch', exact: true }).click()
  await editor.page.getByRole('button', { name: /^Apple Watch Series 10 42mm/ }).click()
  await editor.canvas.waitForRender()
  expect((await frameOnScreen()).zoom).toBe(1)
})
