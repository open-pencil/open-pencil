import { readFile } from 'node:fs/promises'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { pasteFigmaClipboard } from '#tests/helpers/canvas/figma-paste'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('FigJam connectors draw their elbows, curve, caps, dashes, and label as Figma routed them', async () => {
  const html = await readFile('tests/fixtures/clipboard/figjam-connectors.html', 'utf8')
  await pasteFigmaClipboard(editor.page, html)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('figjam-connectors.png')
})

test('dragging a sticky routes the connectors attached to it again', async () => {
  const html = await readFile('tests/fixtures/clipboard/figjam-connectors.html', 'utf8')
  await pasteFigmaClipboard(editor.page, html)
  await editor.canvas.waitForRender()
  const center = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const sticky = store.graph
      .getChildren(store.state.currentPageId)
      .find((node) => node.name === 'c-B')
    if (!sticky) throw new Error('No sticky c-B')
    const { zoom, panX, panY } = store.state
    return {
      x: (sticky.x + sticky.width / 2) * zoom + panX,
      y: (sticky.y + sticky.height / 2) * zoom + panY
    }
  })
  await editor.canvas.drag(center.x, center.y, center.x - 260, center.y - 120)
  await editor.page.evaluate(() => window.openPencil?.getStore?.()?.clearSelection())
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'figjam-connectors-moved.png'
  )
})
