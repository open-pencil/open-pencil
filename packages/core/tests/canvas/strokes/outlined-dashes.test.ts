import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type SceneNode, type Stroke } from '@open-pencil/scene-graph'

import { expectDefined } from '#core-tests/helpers/assert'
import { expectFigmaRow, renderRow } from '#core-tests/helpers/figma-rows'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

/** Rows of alpha from Figma 126 exports, read as `renderRow` reads ours. */
const FIGMA = {
  roundCaps: [
    0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 239, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 0, 239, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 0, 239, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 239,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 239, 255, 255, 255, 255,
    255, 255, 255, 255, 0, 0, 0, 0
  ],
  squareCaps: [
    0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 0, 0, 0, 0
  ],
  insideRoundCaps: [
    0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 144, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 144, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 144, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 144, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 144, 255, 255, 255, 255, 255,
    255, 255, 0, 0, 0, 0, 0, 0
  ],
  roundJoin: [
    0, 0, 0, 32, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 0
  ],
  bevelJoin: [
    0, 0, 0, 0, 127, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 0
  ],
  smoothed: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16, 96, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 0
  ]
}

/** A 150 × 90 rectangle at (120, 70) with an 8 px blue stroke dashed 20, 10. */
function dashedRect(props: Partial<SceneNode> = {}, align: Stroke['align'] = 'CENTER') {
  return (graph: SceneGraph, hostId: string) => {
    graph.createNode('RECTANGLE', hostId, {
      x: 120,
      y: 70,
      width: 150,
      height: 90,
      fills: [],
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 1, a: 1 },
          opacity: 1,
          visible: true,
          weight: 8,
          align,
          dashPattern: [20, 10]
        }
      ],
      strokeWeight: 8,
      strokeAlign: align,
      ...props
    })
  }
}

const row = (props: Partial<SceneNode>, y: number, x0: number, x1: number, align?: Stroke['align']) =>
  renderRow(ck, renderer, dashedRect(props, align), y, x0, x1)

describe('dashes with caps, joins, and smoothed corners, as in Figma', () => {
  test('cap each dash end but where dashes meet at a corner', () => {
    expectFigmaRow(row({ strokeCap: 'ROUND' }, 70, 112, 280), FIGMA.roundCaps)
    expectFigmaRow(row({ strokeCap: 'SQUARE' }, 70, 112, 280), FIGMA.squareCaps)
  })

  test('cap inside strokes at double width, which nearly closes the gaps at this weight', () => {
    expectFigmaRow(row({ strokeCap: 'ROUND' }, 76, 112, 280, 'INSIDE'), FIGMA.insideRoundCaps)
  })

  test('join the dashes that turn a sharp corner with the stroke’s join', () => {
    expectFigmaRow(row({ strokeJoin: 'ROUND' }, 67, 110, 160), FIGMA.roundJoin)
    expectFigmaRow(row({ strokeJoin: 'BEVEL' }, 67, 110, 160), FIGMA.bevelJoin)
  })

  test('dash each curve of a smoothed corner on its own', () => {
    const smoothed = { width: 170, height: 100, cornerRadius: 25, cornerSmoothing: 0.6 }
    expectFigmaRow(row(smoothed, 66, 112, 170), FIGMA.smoothed)
  })

  test('redraw the dashes when the layer is resized', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    dashedRect({ strokeCap: 'ROUND' })(graph, page)
    const [id] = expectDefined(graph.getNode(page)).childIds
    const draw = (target: SkiaRenderer) =>
      renderNodesToImage(ck, target, graph, page, [id], { scale: 1, format: 'PNG' })
    draw(renderer)
    graph.updateNode(id, { width: 170 })
    const fresh = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
    try {
      expect(draw(renderer)).toEqual(draw(fresh))
    } finally {
      fresh.destroy()
    }
  })
})
