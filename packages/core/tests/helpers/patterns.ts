import { unpremultipliedPixels } from '#core-tests/helpers/figma-rows'

import type { CanvasKit } from '@open-pencil/canvaskit'
import type { SkiaRenderer } from '@open-pencil/core/canvas'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import type { Effect, Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { expectDefined } from '@open-pencil/test-support/assert'

export const TILE = 10
export const TARGET = 40

export function solid(color: Color): Fill {
  return { type: 'SOLID', color, opacity: 1, visible: true }
}

export const WHITE = { r: 1, g: 1, b: 1, a: 1 }
export const BLACK = { r: 0, g: 0, b: 0, a: 1 }
export const RED = { r: 1, g: 0, b: 0, a: 1 }

export function patternOf(sourceNodeId: string, color: Color = BLACK): Fill {
  return {
    type: 'PATTERN',
    color,
    opacity: 1,
    visible: true,
    sourceNodeId,
    patternSpacing: { x: 0, y: 0 },
    patternTileType: 'RECTANGULAR',
    horizontalAlignment: 'START',
    verticalAlignment: 'START'
  }
}

export function addOutlineSource(
  graph: SceneGraph,
  parentId: string,
  props: Partial<SceneNode> = {}
): SceneNode {
  const source = graph.createNode('FRAME', parentId, {
    x: 300,
    y: 200,
    width: TILE,
    height: TILE,
    fills: [],
    ...props
  })
  addOutline(graph, source.id, { x: 2, y: 3, width: 6, height: 4 })
  return source
}

export function addOutline(
  graph: SceneGraph,
  parentId: string,
  box: Pick<SceneNode, 'x' | 'y' | 'width' | 'height'>
): SceneNode {
  return graph.createNode('RECTANGLE', parentId, {
    ...box,
    fills: [],
    strokeWeight: 1,
    strokes: [{ ...solid(BLACK), weight: 1, align: 'INSIDE' }]
  })
}

export function addTarget(
  graph: SceneGraph,
  parentId: string,
  source: SceneNode,
  effects: Effect[] = []
): SceneNode {
  return graph.createNode('RECTANGLE', parentId, {
    width: TARGET,
    height: TARGET,
    fills: [solid(WHITE), patternOf(source.id)],
    effects
  })
}

export function channel(ck: CanvasKit, png: Uint8Array, index: number): number[] {
  const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
  try {
    const pixels = unpremultipliedPixels(ck, image)
    return Array.from({ length: image.width() * image.height() }, (_, i) => pixels[i * 4 + index])
  } finally {
    image.delete()
  }
}

export function exportLayer(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  page: string,
  layer: SceneNode
): Uint8Array {
  return expectDefined(
    renderNodesToImage(ck, renderer, graph, page, [layer.id], {
      scale: 1,
      format: 'PNG',
      trimTransparent: false
    }),
    'png'
  )
}

export function darkPixels(values: number[]): number[] {
  return values.map((value) => (value < 128 ? 1 : 0))
}
