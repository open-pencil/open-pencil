import { beforeAll, describe, expect, test } from 'bun:test'

import { renderNodesToImage, SceneGraph, SkiaRenderer } from '@open-pencil/core'
import { getWorldMatrix } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { prepareSelectionRenderGraph } from '#core/io/formats/raster/render'
import { extractExportGraph } from '#core/io/subgraph'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

function rectangleCommandsBlob(x: number, y: number, width: number, height: number): Uint8Array {
  const blob = new Uint8Array(1 + 4 * 9 + 1)
  const view = new DataView(blob.buffer)
  const points = [
    { command: 1, x, y },
    { command: 2, x: x + width, y },
    { command: 2, x: x + width, y: y + height },
    { command: 2, x, y: y + height }
  ]
  let offset = 0
  for (const point of points) {
    blob[offset] = point.command
    view.setFloat32(offset + 1, point.x, true)
    view.setFloat32(offset + 5, point.y, true)
    offset += 9
  }
  blob[offset] = 0
  return blob
}

beforeAll(async () => {
  ck = await initCanvasKit()
})

describe('raster export', () => {
  test('preserves transformed top-level nodes when preparing a page export', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const connector = graph.createNode('FRAME', page.id, {
      x: 120,
      y: 80,
      width: 40,
      height: 20,
      rotation: 90,
      flipX: true,
      fills: []
    })
    const before = getWorldMatrix(connector, graph)

    const extracted = extractExportGraph(graph, { scope: 'selection', nodeIds: page.childIds })
    const exportPageId = expectDefined(extracted.pageId, 'export page')
    prepareSelectionRenderGraph(graph, extracted.graph, exportPageId, page.childIds)

    const exportedConnector = expectDefined(extracted.graph.getNode(connector.id), 'connector')
    expect(getWorldMatrix(exportedConnector, extracted.graph)).toEqual(before)
  })

  test('preserves the world transform when flattening a nested export selection', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const parent = graph.createNode('FRAME', page.id, {
      x: 200,
      y: 100,
      width: 100,
      height: 80,
      rotation: -90,
      flipX: true,
      fills: []
    })
    const connector = graph.createNode('FRAME', parent.id, {
      x: 15,
      y: 25,
      width: 40,
      height: 20,
      rotation: 90,
      flipX: true,
      fills: []
    })
    const before = getWorldMatrix(connector, graph)
    const extracted = extractExportGraph(graph, {
      scope: 'selection',
      nodeIds: [connector.id]
    })
    const exportPageId = expectDefined(extracted.pageId, 'export page')
    prepareSelectionRenderGraph(graph, extracted.graph, exportPageId, [connector.id])

    const exportedConnector = expectDefined(extracted.graph.getNode(connector.id), 'connector')
    const after = getWorldMatrix(exportedConnector, extracted.graph)
    for (let index = 0; index < before.length; index++) {
      expect(after[index]).toBeCloseTo(before[index], 8)
    }
  })

  test('selection export excludes ancestor backgrounds', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const section = graph.createNode('SECTION', page.id, {
      x: 20,
      y: 30,
      width: 100,
      height: 100,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.4, g: 0.4, b: 0.4, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })
    const component = graph.createNode('COMPONENT', section.id, {
      x: 10,
      y: 10,
      width: 10,
      height: 10,
      fills: []
    })
    graph.createNode('RECTANGLE', component.id, {
      x: 3,
      y: 3,
      width: 4,
      height: 4,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)

    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [component.id], {
          scale: 1,
          format: 'PNG'
        }),
        'png'
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB,
          width: image.width(),
          height: image.height()
        }),
        'pixels'
      )

      expect(pixels[3]).toBe(0)
      const centerAlpha = pixels[(5 * image.width() + 5) * 4 + 3]
      expect(centerAlpha).toBeGreaterThan(0)

      image.delete()
    } finally {
      surface.delete()
    }
  })

  test('keeps one-pixel transparent fringes when trimming exports', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const vector = graph.createNode('VECTOR', page.id, {
      width: 10,
      height: 10,
      fillGeometry: [{ commandsBlob: rectangleCommandsBlob(1, 1, 8, 8) }],
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)

    try {
      const png = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [vector.id], {
          scale: 1,
          format: 'PNG',
          trimTransparent: true
        }),
        'png'
      )
      const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')

      expect(image.width()).toBe(10)
      expect(image.height()).toBe(10)

      image.delete()
    } finally {
      surface.delete()
    }
  })

  test('page exports can trim transparent text padding', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      text: 'Primitives',
      fontSize: 30,
      lineHeight: 40,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })

    const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    await renderer.loadFonts()

    try {
      const untrimmed = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG'
        }),
        'untrimmed png'
      )
      const trimmed = expectDefined(
        renderNodesToImage(ck, renderer, graph, page.id, [text.id], {
          scale: 1,
          format: 'PNG',
          trimTransparent: true
        }),
        'trimmed png'
      )

      const untrimmedImage = expectDefined(ck.MakeImageFromEncoded(untrimmed), 'untrimmed image')
      const trimmedImage = expectDefined(ck.MakeImageFromEncoded(trimmed), 'trimmed image')

      expect(untrimmedImage.height()).toBe(40)
      expect(trimmedImage.height()).toBeLessThan(untrimmedImage.height())
      expect(trimmedImage.width()).toBeLessThan(untrimmedImage.width())

      untrimmedImage.delete()
      trimmedImage.delete()
    } finally {
      surface.delete()
    }
  })
})
