import type { Page } from '@playwright/test'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

async function replaceGraph(page: Page, side: 'upper-right' | 'lower-left') {
  await page.evaluate((side) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const SceneGraphConstructor = store.graph.constructor as new () => SceneGraph
    const graph = new SceneGraphConstructor()
    const canvasPage = graph.getPages()[0]
    if (!canvasPage) throw new Error('Default canvas page unavailable')

    const vertices =
      side === 'upper-right'
        ? [
            { x: 0, y: 0 },
            { x: 120, y: 0 },
            { x: 120, y: 120 }
          ]
        : [
            { x: 0, y: 0 },
            { x: 0, y: 120 },
            { x: 120, y: 120 }
          ]
    graph.createNodeWithId('reused-vector', 'VECTOR', canvasPage.id, {
      x: 200,
      y: 150,
      width: 120,
      height: 120,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      vectorNetwork: {
        vertices,
        segments: [0, 1, 2].map((start) => ({
          start,
          end: (start + 1) % 3,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        })),
        regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
      }
    })
    store.replaceGraph(graph)
  }, side)
}

test('a replacement graph redraws vectors when it reuses a node id', async ({ page }) => {
  await page.goto('/?test&no-rulers&no-chrome')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await replaceGraph(page, 'upper-right')
  await canvas.waitForRender()
  await replaceGraph(page, 'lower-left')
  await canvas.waitForRender()

  expect(await canvas.screenshotCanvasRegion(600, 450)).toMatchSnapshot(
    'graph-replacement-vector.png'
  )
  canvas.assertNoErrors()
})
