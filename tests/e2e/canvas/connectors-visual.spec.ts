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

test('connectors draw their filled caps, the end handles of a selected one, and an attach target', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const page = store.state.currentPageId
    const box = (x: number, y: number) =>
      store.graph.createNode('RECTANGLE', page, {
        x,
        y,
        width: 160,
        height: 120,
        fills: [
          { type: 'SOLID', color: { r: 0.85, g: 0.88, b: 0.95, a: 1 }, opacity: 1, visible: true }
        ]
      })
    const caps = [
      'TRIANGLE_FILLED',
      'DIAMOND_FILLED',
      'CIRCLE_FILLED',
      'ARROW_EQUILATERAL'
    ] as const
    let selected = ''
    caps.forEach((cap, row) => {
      const from = box(40, 40 + row * 160)
      const to = box(480, 100 + row * 160)
      store.setTool('CONNECTOR')
      store.connectorBegin(from.x + 80, from.y + 60)
      store.connectorRelease(to.x + 80, to.y + 60, true)
      const connector = store.graph.getChildren(page).findLast((node) => node.type === 'CONNECTOR')
      if (!connector) throw new Error('No connector')
      store.setConnectorCap([connector.id], 'start', cap)
      store.setConnectorCap([connector.id], 'end', cap)
      if (row === 0) selected = connector.id
    })
    store.setTool('SELECT')
    store.select([selected])
    const target = box(760, 300)
    store.state.connectorTarget = { nodeId: target.id, magnet: 'TOP' }
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'connector-caps-and-handles.png'
  )
})
