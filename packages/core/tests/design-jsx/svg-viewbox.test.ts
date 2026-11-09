import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { renderJSX } from '@open-pencil/core/design-jsx'
import { comparePNGs, createCanvasKitRasterCodec, renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { expectDefined } from '@open-pencil/test-support/assert'

/** The icon box of nonzero-origin SVG artwork, committed so CI compares pixels and does not rewrite it. */
const VIEWBOX_SNAPSHOT = join(import.meta.dir, 'snapshots', 'svg-nonzero-viewbox-origin.png')

/** The issue's square, drawn in viewBox user units and mapped into a `size` icon. */
function icon(viewBox: string, x: number, y: number, size = 100, attributes = '') {
  return `<svg viewBox="${viewBox}" size={${size}}${attributes}><rect x={${x}} y={${y}} width={20} height={20} /></svg>`
}

async function iconVector(jsx: string): Promise<SceneNode> {
  const graph = new SceneGraph()
  const [frame] = await renderJSX(graph, jsx)
  return expectDefined(
    graph.getChildren(frame.id).find((node) => node.type === 'VECTOR'),
    'vector'
  )
}

async function rectVertices(jsx: string): Promise<Vector[]> {
  return (await iconVector(jsx)).vectorNetwork?.vertices.map(({ x, y }) => ({ x, y })) ?? []
}

describe('inline SVG viewBox origin', () => {
  test('places a shape at the viewBox origin on the icon origin', async () => {
    expect(await rectVertices(icon('50 50 100 100', 50, 50))).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ])
  })

  test('places a shape at a negative viewBox origin on the icon origin', async () => {
    expect(await rectVertices(icon('-50 -50 100 100', -50, -50))).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ])
  })

  test('leaves a zero-origin viewBox where it was drawn', async () => {
    expect(await rectVertices(icon('0 0 100 100', 10, 30))).toEqual([
      { x: 10, y: 30 },
      { x: 30, y: 30 },
      { x: 30, y: 50 },
      { x: 10, y: 50 }
    ])
  })

  test('fits a viewBox of another aspect ratio centered, as SVG does by default', async () => {
    // xMidYMid meet: the 50 × 100 viewBox keeps scale 1 and is centered across the 100px box.
    expect(await rectVertices(icon('50 50 50 100', 50, 50, 100))).toEqual([
      { x: 25, y: 0 },
      { x: 45, y: 0 },
      { x: 45, y: 20 },
      { x: 25, y: 20 }
    ])
  })

  test('maps the viewBox into the layer box that w and h set', async () => {
    // A 200 × 100 viewBox fills a 200 × 100 layer, rather than being centered in a 200px square.
    const jsx =
      '<svg viewBox="0 0 200 100" w={200} h={100}><rect x={0} y={0} width={20} height={20} /></svg>'
    expect(await rectVertices(jsx)).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ])
  })

  test('stretches from the viewBox origin with preserveAspectRatio none', async () => {
    // 50 user units map to 100px, so a 20-unit square at the origin becomes 40px wide at (0, 0).
    const jsx = icon('50 50 50 100', 50, 50, 100, ' preserveAspectRatio="none"')
    expect(await rectVertices(jsx)).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 20 },
      { x: 0, y: 20 }
    ])
  })

  test('applies an element transform in user space before the viewBox origin', async () => {
    const jsx =
      '<svg viewBox="50 50 100 100" size={100}><g transform="scale(2)"><rect x={50} y={50} width={20} height={20} /></g></svg>'
    // scale(2) grows the square about the user origin, then the viewBox shifts it back by 50.
    expect(await rectVertices(jsx)).toEqual([
      { x: 50, y: 50 },
      { x: 90, y: 50 },
      { x: 90, y: 90 },
      { x: 50, y: 90 }
    ])
  })

  test('applies the root svg transform about the box center, outside the viewBox', async () => {
    // Chrome draws this square at (80, 50), 20px: the viewBox makes it 40px at the origin, and
    // the root transform halves it about the box center (100, 100), then moves it 30px right.
    const jsx = icon('50 50 100 100', 50, 50, 200, ' transform="translate(30 0) scale(0.5)"')
    expect(await rectVertices(jsx)).toEqual([
      { x: 80, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 70 },
      { x: 80, y: 70 }
    ])
  })

  test('keeps a descendant transform inside the viewBox and the root transform outside', async () => {
    const jsx =
      '<svg viewBox="50 50 100 100" size={100} transform="scale(2)"><g transform="translate(10 0)"><rect x={50} y={50} width={20} height={20} /></g></svg>'
    // translate(10) in user space, the viewBox shifts by 50, then the root doubles about (50, 50).
    expect(await rectVertices(jsx)).toEqual([
      { x: -30, y: -50 },
      { x: 10, y: -50 },
      { x: 10, y: -10 },
      { x: -30, y: -10 }
    ])
  })

  test('draws nonzero-origin SVG artwork in the icon box', async () => {
    const jsx =
      '<svg viewBox="50 50 100 100" size={100}><rect x={50} y={50} width={20} height={20} fill="#e11d48" /><rect x={70} y={50} width={20} height={20} fill="#2563eb" /></svg>'
    const graph = new SceneGraph()
    const [frame] = await renderJSX(graph, jsx)
    const page = expectDefined(graph.getPages()[0], 'page')
    const ck = await getCanvasKit()
    const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1), 'surface'))
    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [frame.id], {
          scale: 1,
          format: 'PNG',
          useAbsoluteBounds: true
        }),
        'icon PNG'
      )
      const comparison = comparePNGs(
        createCanvasKitRasterCodec(ck),
        new Uint8Array(await Bun.file(VIEWBOX_SNAPSHOT).bytes()),
        png,
        { threshold: 0 }
      )
      expect(comparison).toEqual({
        width: 100,
        height: 100,
        changedPixels: 0,
        totalPixels: 10_000,
        mask: null
      })
    } finally {
      renderer.destroy()
    }
  })

  test('keeps a stroke at the shorter axis of composed non-uniform scales', async () => {
    // 100px viewport, viewBox 0 0 50 100 stretches x by 2 (preserveAspectRatio none).
    // Child scale(0.5 1), that stretch, and root scale(2 1) about the box center compose to
    // scale(2 1). A 4-unit stroke stays 4px. Multiplying each transform's shorter axis makes it 2px.
    const jsx =
      '<svg viewBox="0 0 50 100" size={100} preserveAspectRatio="none" transform="scale(2 1)"><line x1={0} y1={0} x2={10} y2={0} stroke="black" strokeWidth={4} transform="scale(0.5 1)" /></svg>'
    const vector = await iconVector(jsx)
    expect(vector.vectorNetwork?.vertices.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: -50, y: 0 },
      { x: -30, y: 0 }
    ])
    expect(expectDefined(vector.strokes[0], 'stroke').weight).toBe(4)
  })
})
