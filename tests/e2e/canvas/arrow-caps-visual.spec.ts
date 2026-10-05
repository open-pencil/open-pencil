import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  // Heads are small relative to the canvas: the default percentage
  // tolerance could absorb a lost head, so pin an absolute pixel budget
  // below the footprint of the smallest head in the scene.
  expect(buffer).toMatchSnapshot(`${name}.png`, { maxDiffPixels: 24 })
}

test('arrow stroke caps', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const ink = { r: 0.08, g: 0.1, b: 0.18, a: 1 }
    const solidStroke = (
      weight: number,
      dashPattern?: number[],
      align: 'INSIDE' | 'CENTER' | 'OUTSIDE' = 'CENTER'
    ) => [
      { type: 'SOLID' as const, color: ink, weight, visible: true, opacity: 1, align, dashPattern }
    ]

    store.graph.createNode('LINE', pageId, {
      name: 'Equilateral line',
      x: 60,
      y: 60,
      width: 220,
      height: 0,
      strokeCap: 'ARROW_EQUILATERAL',
      strokes: solidStroke(2)
    })
    store.graph.createNode('LINE', pageId, {
      name: 'Lines-cap line',
      x: 60,
      y: 110,
      width: 220,
      height: 0,
      strokeCap: 'ARROW_LINES',
      strokes: solidStroke(2)
    })
    store.graph.createNode('LINE', pageId, {
      name: 'Heavy equilateral line',
      x: 60,
      y: 160,
      width: 220,
      height: 0,
      strokeCap: 'ARROW_EQUILATERAL',
      strokes: solidStroke(5)
    })
    store.graph.createNode('LINE', pageId, {
      name: 'Dashed arrow line',
      x: 60,
      y: 216,
      width: 220,
      height: 0,
      strokeCap: 'ARROW_EQUILATERAL',
      strokes: solidStroke(2, [10, 6])
    })
    store.graph.createNode('LINE', pageId, {
      name: 'Rotated arrow line',
      x: 330,
      y: 60,
      width: 150,
      height: 0,
      rotation: 32,
      strokeCap: 'ARROW_LINES',
      strokes: solidStroke(3)
    })

    store.graph.createNode('VECTOR', pageId, {
      name: 'Open polyline with node cap',
      x: 330,
      y: 170,
      width: 150,
      height: 70,
      strokeCap: 'ARROW_EQUILATERAL',
      strokes: solidStroke(2),
      vectorNetwork: {
        vertices: [
          { x: 0, y: 70 },
          { x: 75, y: 0 },
          { x: 150, y: 70 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: []
      }
    })
    store.graph.createNode('VECTOR', pageId, {
      name: 'Curved one-ended arrow',
      x: 60,
      y: 270,
      width: 200,
      height: 60,
      strokes: solidStroke(2),
      vectorNetwork: {
        vertices: [
          { x: 0, y: 60 },
          { x: 200, y: 60, strokeCap: 'ARROW_EQUILATERAL' }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 90, y: -70 }, tangentEnd: { x: -90, y: -70 } }
        ],
        regions: []
      }
    })
    store.graph.createNode('VECTOR', pageId, {
      name: 'Closed path keeps no heads',
      x: 330,
      y: 270,
      width: 90,
      height: 70,
      strokeCap: 'ARROW_EQUILATERAL',
      strokes: solidStroke(2),
      vectorNetwork: {
        vertices: [
          { x: 45, y: 0 },
          { x: 90, y: 70 },
          { x: 0, y: 70 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: []
      }
    })
    store.graph.createNode('VECTOR', pageId, {
      name: 'Filled open vector keeps heads',
      x: 60,
      y: 380,
      width: 200,
      height: 60,
      strokeCap: 'ARROW_EQUILATERAL',
      strokes: solidStroke(2),
      fills: [
        { type: 'SOLID', color: { r: 0.55, g: 0.75, b: 0.95, a: 1 }, visible: true, opacity: 0.4 }
      ],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 60 },
          { x: 200, y: 60 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 90, y: -70 }, tangentEnd: { x: -90, y: -70 } }
        ],
        regions: []
      }
    })
    store.graph.createNode('VECTOR', pageId, {
      name: 'Outside-aligned stroke keeps heads',
      x: 330,
      y: 390,
      width: 150,
      height: 50,
      strokeCap: 'ARROW_LINES',
      strokes: solidStroke(2, undefined, 'OUTSIDE'),
      vectorNetwork: {
        vertices: [
          { x: 0, y: 50 },
          { x: 75, y: 0 },
          { x: 150, y: 50 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: []
      }
    })

    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await expectCanvas('arrow-stroke-caps')
})
