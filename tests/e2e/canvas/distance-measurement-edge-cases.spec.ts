import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function showMeasurement(targetId: string) {
  await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.hoveredNodeId = id
    store.setMeasurementMode('shallow')
    store.requestRepaint()
  }, targetId)
  await editor.canvas.waitForRender()
}

test('renders containment, multi-selection, rotation, and overlap edge cases', async () => {
  const targets = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const pageId = store.state.currentPageId
    const fill = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, visible: true, opacity: 1 }
    ]

    const container = store.graph.createNode('FRAME', pageId, {
      x: 60,
      y: 70,
      width: 260,
      height: 210,
      fills: fill(1, 1, 1),
      strokes: [
        {
          color: { r: 0.7, g: 0.7, b: 0.7, a: 1 },
          weight: 1,
          opacity: 1,
          visible: true,
          align: 'INSIDE',
          cap: 'NONE',
          join: 'MITER',
          dashPattern: []
        }
      ]
    })
    const child = store.graph.createNode('RECTANGLE', container.id, {
      x: 40,
      y: 50,
      width: 90,
      height: 60,
      fills: fill(0.3, 0.55, 0.95)
    })

    const first = store.graph.createNode('RECTANGLE', pageId, {
      x: 430,
      y: 90,
      width: 60,
      height: 50,
      fills: fill(0.3, 0.55, 0.95)
    })
    const second = store.graph.createNode('RECTANGLE', pageId, {
      x: 500,
      y: 160,
      width: 60,
      height: 50,
      fills: fill(0.3, 0.55, 0.95)
    })
    const rotated = store.graph.createNode('RECTANGLE', pageId, {
      x: 660,
      y: 120,
      width: 110,
      height: 70,
      rotation: 28,
      fills: fill(0.95, 0.55, 0.2)
    })

    const overlapSelected = store.graph.createNode('RECTANGLE', pageId, {
      x: 100,
      y: 390,
      width: 100,
      height: 90,
      fills: fill(0.3, 0.55, 0.95)
    })
    const overlapTarget = store.graph.createNode('RECTANGLE', pageId, {
      x: 160,
      y: 430,
      width: 110,
      height: 80,
      fills: fill(0.95, 0.55, 0.2)
    })

    store.select([child.id])
    store.requestRender()
    return {
      container: container.id,
      first: first.id,
      second: second.id,
      rotated: rotated.id,
      overlapSelected: overlapSelected.id,
      overlapTarget: overlapTarget.id
    }
  })
  await editor.canvas.waitForRender()

  await showMeasurement(targets.container)
  expect(
    await editor.page.screenshot({ clip: { x: 40, y: 40, width: 310, height: 270 } })
  ).toMatchSnapshot('distance-containment.png')

  await editor.page.evaluate(({ first, second }) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.select([first, second])
  }, targets)
  await showMeasurement(targets.rotated)
  expect(
    await editor.page.screenshot({ clip: { x: 390, y: 40, width: 430, height: 260 } })
  ).toMatchSnapshot('distance-multi-rotation.png')

  await editor.page.evaluate(
    (id) => window.openPencil?.getStore?.().select([id]),
    targets.overlapSelected
  )
  await showMeasurement(targets.overlapTarget)
  expect(
    await editor.page.screenshot({ clip: { x: 70, y: 350, width: 240, height: 200 } })
  ).toMatchSnapshot('distance-overlap.png')
})
