import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { renderJSX } from '@open-pencil/core/design-jsx'
import {
  comparePNGs,
  createCanvasKitRasterCodec,
  initCanvasKit,
  renderNodesToImage
} from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { expectDefined } from '@open-pencil/test-support/assert'

/** The icon box of nonzero-origin SVG artwork, committed so CI compares pixels and does not rewrite it. */
const VIEWBOX_SNAPSHOT = join(import.meta.dir, 'snapshots', 'svg-nonzero-viewbox-origin.png')

/** The issue's square, drawn in viewBox user units and mapped into a `size` icon. */
function icon(viewBox: string, x: number, y: number, size = 100) {
  return `<svg viewBox="${viewBox}" size={${size}}><rect x={${x}} y={${y}} width={20} height={20} /></svg>`
}

async function rectVertices(jsx: string): Promise<Vector[]> {
  const graph = new SceneGraph()
  const [frame] = await renderJSX(graph, jsx)
  const vector = graph.getChildren(frame.id).find((node) => node.type === 'VECTOR')
  return expectDefined(vector, 'vector').vectorNetwork?.vertices.map(({ x, y }) => ({ x, y })) ?? []
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

  test('scales from the viewBox origin, not from zero', async () => {
    // 50 user units map to 100px, so a 20-unit square at the origin becomes 40px at (0, 0).
    expect(await rectVertices(icon('50 50 50 100', 50, 50, 100))).toEqual([
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

  test('applies the root svg transform outside the viewBox', async () => {
    const jsx =
      '<svg viewBox="50 50 100 100" size={100} transform="scale(2)"><rect x={50} y={50} width={20} height={20} /></svg>'
    // The viewBox moves the square to the icon origin, then the root scale doubles it there.
    expect(await rectVertices(jsx)).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 }
    ])
  })

  test('keeps a descendant transform inside the viewBox and the root transform outside', async () => {
    const jsx =
      '<svg viewBox="50 50 100 100" size={100} transform="scale(2)"><g transform="translate(10 0)"><rect x={50} y={50} width={20} height={20} /></g></svg>'
    // translate(10) in user space, the viewBox shifts by 50, then the root scale doubles.
    expect(await rectVertices(jsx)).toEqual([
      { x: 20, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 40 },
      { x: 20, y: 40 }
    ])
  })

  test('draws nonzero-origin SVG artwork in the icon box', async () => {
    const jsx =
      '<svg viewBox="50 50 100 100" size={100} transform="scale(2)"><rect x={50} y={50} width={20} height={20} fill="#e11d48" /><rect x={70} y={50} width={20} height={20} fill="#2563eb" /></svg>'
    const graph = new SceneGraph()
    const [frame] = await renderJSX(graph, jsx)
    const page = expectDefined(graph.getPages()[0], 'page')
    const ck = await initCanvasKit()
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
})
