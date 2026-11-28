import { afterAll, describe, expect, test } from 'bun:test'

import {
  BLACK,
  RED,
  TARGET,
  TILE,
  WHITE,
  addOutline,
  addOutlineSource,
  addTarget,
  channel,
  darkPixels,
  exportLayer,
  patternOf,
  solid
} from '#core-tests/helpers/patterns'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { appendAll } from '@open-pencil/std/arrays'
import { expectDefined } from '@open-pencil/test-support/assert'

const SURFACE = 100

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SURFACE, SURFACE), 'surface'))
afterAll(() => renderer.destroy())

function exported(graph: SceneGraph, page: string, layer: SceneNode): Uint8Array {
  return exportLayer(ck, renderer, graph, page, layer)
}

function tiledSourceCoverage(graph: SceneGraph, page: string, source: SceneNode): number[] {
  const alpha = channel(ck, exported(graph, page, source), 3)
  const coverage = darkPixels(alpha.map((value) => 255 - value))
  return Array.from({ length: TARGET * TARGET }, (_, index) => {
    const x = (index % TARGET) % TILE
    const y = Math.floor(index / TARGET) % TILE
    return coverage[y * TILE + x]
  })
}

function outlinedScene(sourceOnOtherPage: boolean) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const sourcePage = sourceOnOtherPage ? graph.addPage('Sources').id : page
  const source = addOutlineSource(graph, sourcePage)
  const target = addTarget(graph, page, source)
  return { graph, page, source, target }
}

function drawPage(graph: SceneGraph, page: string): Uint8Array {
  renderer.pageId = page
  const canvas = renderer.surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  renderer.renderSceneToCanvas(canvas, graph, page)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    return Uint8Array.from(
      expectDefined(
        image.readPixels(0, 0, {
          width: SURFACE,
          height: SURFACE,
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        }),
        'pixels'
      )
    )
  } finally {
    image.delete()
  }
}

function pixelAt(pixels: Uint8Array, x: number, y: number): number[] {
  const offset = (y * SURFACE + x) * 4
  return Array.from(pixels.subarray(offset, offset + 4))
}

function regionAt(pixels: Uint8Array, left: number): number[] {
  const region: number[] = []
  for (let y = 0; y < TARGET; y++) {
    for (let x = left; x < left + TARGET; x++) {
      appendAll(region, pixelAt(pixels, x, y))
    }
  }
  return region
}

function canvasRedAt(pixels: Uint8Array, box: Pick<SceneNode, 'x' | 'y' | 'width' | 'height'>) {
  return Array.from({ length: box.width * box.height }, (_, index) => {
    const x = box.x + (index % box.width)
    const y = box.y + Math.floor(index / box.width)
    return pixelAt(pixels, x, y)[0]
  })
}

function mutualSources(targetsFirst: 'A' | 'B') {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const sources = graph.addPage('Sources').id
  const a = addOutlineSource(graph, sources)
  const b = graph.createNode('FRAME', sources, { x: 400, width: TILE, height: TILE, fills: [] })
  graph.createNode('RECTANGLE', b.id, { x: 4, y: 4, width: 2, height: 2, fills: [solid(BLACK)] })
  graph.createNode('RECTANGLE', a.id, {
    y: TILE - 2,
    width: TILE,
    height: 2,
    fills: [patternOf(b.id)]
  })
  graph.createNode('RECTANGLE', b.id, { width: TILE, height: 2, fills: [patternOf(a.id)] })
  const order = targetsFirst === 'A' ? [a, b] : [b, a]
  for (const source of order) {
    const target = addTarget(graph, page, source)
    graph.updateNode(target.id, { x: source === a ? 0 : 50 })
  }
  return drawPage(graph, page)
}

describe('pattern fills', () => {
  test('tile what the source layer draws, children and strokes included', () => {
    const { graph, page, source, target } = outlinedScene(false)
    const tiled = tiledSourceCoverage(graph, page, source)
    expect(tiled.some(Boolean)).toBe(true)
    expect(darkPixels(channel(ck, exported(graph, page, target), 0))).toEqual(tiled)
  })

  test('find a source that sits on another page when the layer is exported alone', () => {
    const { graph, page, source, target } = outlinedScene(true)
    const sourcePage = expectDefined(source.parentId, 'source page')
    const tiled = tiledSourceCoverage(graph, sourcePage, source)
    expect(darkPixels(channel(ck, exported(graph, page, target), 0))).toEqual(tiled)
  })

  test('draw a source that tiles itself without recursing', () => {
    const { graph, page, source, target } = outlinedScene(false)
    const outline = tiledSourceCoverage(graph, page, source)
    graph.createNode('RECTANGLE', source.id, {
      y: TILE - 1,
      width: TILE,
      height: 1,
      fills: [patternOf(source.id)]
    })
    const drawn = darkPixels(channel(ck, exported(graph, page, target), 0))
    const aboveSelfTile = (_: number, index: number) => Math.floor(index / TARGET) % TILE < TILE - 1
    expect(drawn.filter(aboveSelfTile)).toEqual(outline.filter(aboveSelfTile))
  })

  test('draw sources that tile each other the same whichever is drawn first', () => {
    const aFirst = mutualSources('A')
    const bFirst = mutualSources('B')
    expect(regionAt(aFirst, 0)).toEqual(regionAt(bFirst, 0))
    expect(regionAt(aFirst, 50)).toEqual(regionAt(bFirst, 50))
  })

  test('fall back to the paint color when a hidden source has nothing to tile', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const source = addOutlineSource(graph, page, { visible: false })
    const target = graph.createNode('RECTANGLE', page, {
      width: TARGET,
      height: TARGET,
      fills: [solid(WHITE), patternOf(source.id, RED)]
    })
    const red = channel(ck, exported(graph, page, target), 0)
    const green = channel(ck, exported(graph, page, target), 1)
    expect(red.every((value) => value > 250)).toBe(true)
    expect(green.every((value) => value < 5)).toBe(true)
  })

  test('tile the own fills of a source the canvas does not draw as a layer', () => {
    for (const flag of [{ internalOnly: true }, { isMask: true }]) {
      const graph = new SceneGraph()
      const page = graph.getPages()[0].id
      const source = graph.createNode('FRAME', page, {
        x: 300,
        width: TILE,
        height: TILE,
        fills: [solid(BLACK)],
        ...flag
      })
      const target = addTarget(graph, page, source)
      const red = channel(ck, exported(graph, page, target), 0)
      expect(red.every((value) => value < 5)).toBe(true)
    }
  })

  test('redraw a layer with its own cached picture when its source changes', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const source = addOutlineSource(graph, page)
    addTarget(graph, page, source, [
      {
        type: 'DROP_SHADOW',
        color: BLACK,
        offset: { x: 60, y: 60 },
        radius: 0,
        spread: 0,
        visible: true
      }
    ])
    renderer.invalidateAllPictures()
    expect(pixelAt(drawPage(graph, page), 2, 5).slice(0, 3)).toEqual([0, 0, 0])
    const outline = source.childIds[0]
    graph.updateNode(outline, { strokes: [{ ...solid(RED), weight: 1, align: 'INSIDE' }] })
    renderer.invalidateNodePicture(outline)
    expect(pixelAt(drawPage(graph, page), 2, 5).slice(0, 3)).toEqual([255, 0, 0])
  })

  test('export a layer inside the source it tiles as the canvas draws it', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const box = { x: 20, y: 20, width: 2 * TILE, height: 2 * TILE }
    const source = addOutlineSource(graph, page, { ...box, fills: [solid(WHITE)] })
    const layer = graph.createNode('RECTANGLE', source.id, {
      width: box.width,
      height: box.height,
      fills: [solid(WHITE), patternOf(source.id, WHITE)]
    })
    addOutline(graph, source.id, { x: 12, y: 12, width: 6, height: 6 })
    const canvas = darkPixels(canvasRedAt(drawPage(graph, page), box))
    expect(canvas.some(Boolean)).toBe(true)
    expect(darkPixels(channel(ck, exported(graph, page, layer), 0))).toEqual(canvas)
  })
})
