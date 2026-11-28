import type { Canvas, Shader } from '@open-pencil/canvaskit'
import type { Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { patternTileLayout, type PatternTileLayout } from '@open-pencil/scene-graph/paints'

import { drawOffOutputGrid } from '#core/canvas/images/sampling'
import { withWorldViewport } from '#core/canvas/renderer/picture'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'

import { patternTileKey, patternTilesOf, type PatternTiles } from './tiles'

const UNBOUNDED_VIEWPORT = { minX: -1e9, minY: -1e9, maxX: 1e9, maxY: 1e9 }

export type DrawSourceFills = (
  r: SkiaRenderer,
  canvas: Canvas,
  source: SceneNode,
  graph: SceneGraph
) => void

function hasVisibleOwnFill(source: SceneNode): boolean {
  return (
    source.fills.some((fill) => fill.visible) ||
    (source.vectorNetwork?.regions.some((region) => region.fills?.some((fill) => fill.visible)) ??
      false)
  )
}

function drawsAsLayer(source: SceneNode): boolean {
  return source.visible && !source.internalOnly && !source.isMask
}

function drawSourceLayer(r: SkiaRenderer, canvas: Canvas, source: SceneNode, graph: SceneGraph) {
  canvas.translate(-source.x, -source.y)
  withWorldViewport(r, UNBOUNDED_VIEWPORT, () => r.renderNode(canvas, graph, source.id, {}))
}

function recordPatternTile(
  r: SkiaRenderer,
  source: SceneNode,
  graph: SceneGraph,
  layout: PatternTileLayout,
  drawSourceFills: DrawSourceFills
): Shader {
  const tile = r.ck.LTRBRect(0, 0, layout.rect.width, layout.rect.height)
  const recorder = new r.ck.PictureRecorder()
  try {
    const canvas = recorder.beginRecording(tile)
    for (const position of layout.positions) {
      canvas.save()
      canvas.translate(position.x, position.y)
      canvas.scale(layout.scale, layout.scale)
      if (drawsAsLayer(source)) {
        drawSourceLayer(r, canvas, source, graph)
      } else {
        drawSourceFills(r, canvas, source, graph)
      }
      canvas.restore()
    }
    const picture = recorder.finishRecordingAsPicture()
    const shader = picture.makeShader(
      r.ck.TileMode.Repeat,
      r.ck.TileMode.Repeat,
      r.ck.FilterMode.Linear,
      undefined,
      tile
    )
    picture.delete()
    return shader
  } finally {
    recorder.delete()
  }
}

function canDrawSource(tiles: PatternTiles, source: SceneNode): boolean {
  if (source.width <= 0 || source.height <= 0 || tiles.sourcesInProgress.has(source.id)) {
    return false
  }
  return drawsAsLayer(source) || hasVisibleOwnFill(source)
}

function recordWithoutReentry(
  r: SkiaRenderer,
  tiles: PatternTiles,
  source: SceneNode,
  fill: Fill,
  graph: SceneGraph,
  drawSourceFills: DrawSourceFills
): Shader {
  tiles.sourcesInProgress.add(source.id)
  try {
    const layout = patternTileLayout(source, fill)
    return drawOffOutputGrid(r, () => recordPatternTile(r, source, graph, layout, drawSourceFills))
  } finally {
    tiles.sourcesInProgress.delete(source.id)
  }
}

function setFillShader(r: SkiaRenderer, shader: Shader): void {
  r.fillPaint.setShader(shader)
  r.fillPaintShaded = true
}

export function applyPatternFill(
  r: SkiaRenderer,
  fill: Fill,
  node: SceneNode,
  graph: SceneGraph,
  drawSourceFills: DrawSourceFills
): boolean {
  const sourceId = fill.sourceNodeId
  if (!sourceId || sourceId === node.id || sourceId === node.source.id) {
    return false
  }
  const tiles = patternTilesOf(r)
  tiles.prepare(graph, r.fontGeneration)
  if (tiles.unresolvedSources.has(sourceId)) {
    tiles.addTarget(sourceId, node.id)
    return false
  }
  const key = patternTileKey(sourceId, fill)
  const nested = tiles.sourcesInProgress.size > 0
  const cached = nested ? undefined : tiles.shaders.get(key)
  if (cached) {
    tiles.addTarget(cached.sourceId, node.id)
    setFillShader(r, cached.shader)
    return true
  }
  const source = tiles.resolveSource(graph, sourceId)
  if (!source) {
    tiles.addTarget(sourceId, node.id)
    return false
  }
  tiles.addTarget(source.id, node.id)
  if (!canDrawSource(tiles, source)) {
    return false
  }
  const dependsOnRenderState = nested || r.viewportImageRendering
  const shader = recordWithoutReentry(r, tiles, source, fill, graph, drawSourceFills)
  setFillShader(r, shader)
  if (dependsOnRenderState || !tiles.shaders.set(key, { shader, sourceId: source.id })) {
    shader.delete()
  }
  return true
}
