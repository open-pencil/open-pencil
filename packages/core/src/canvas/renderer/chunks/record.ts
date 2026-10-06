import type { Canvas, SkPicture } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { recordWorldPicture, withWorldViewport } from '#core/canvas/renderer/picture'
import { clipNodeShape, nodeHasRadius } from '#core/canvas/shapes'

import type { RenderChunk } from './index'

export interface RecordedRenderChunk {
  chunk: RenderChunk
  picture: SkPicture
}

function clipAncestor(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph, node: SceneNode): void {
  canvas.concat(getWorldMatrix(node, graph))
  clipNodeShape(r, canvas, node, r.ck.LTRBRect(0, 0, node.width, node.height), nodeHasRadius(node))
  const inverse = Matrix.invert(getWorldMatrix(node, graph))
  if (inverse) canvas.concat(inverse)
}

function drawChunkContent(
  renderer: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  chunk: RenderChunk
): void {
  canvas.save()
  for (const ancestorId of chunk.context.ancestorClipIds) {
    const ancestor = graph.getNode(ancestorId)
    if (ancestor) clipAncestor(renderer, canvas, graph, ancestor)
  }
  canvas.concat(chunk.context.parentTransform)
  if (chunk.kind === 'self') renderer.renderNodeSelf(canvas, graph, chunk.nodeId)
  else renderer.renderNode(canvas, graph, chunk.nodeId, {}, 0, 0, true)
  canvas.restore()
}

export function drawRenderChunkDirect(
  renderer: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  chunk: RenderChunk
): void {
  withWorldViewport(renderer, chunk, () => drawChunkContent(renderer, canvas, graph, chunk))
}

export function recordRenderChunk(
  renderer: SkiaRenderer,
  graph: SceneGraph,
  chunk: RenderChunk
): RecordedRenderChunk {
  const picture = recordWorldPicture(renderer, chunk, (canvas) =>
    drawChunkContent(renderer, canvas, graph, chunk)
  )
  return { chunk, picture }
}

export function drawRecordedRenderChunks(canvas: Canvas, chunks: RecordedRenderChunk[]): void {
  for (const recorded of chunks) canvas.drawPicture(recorded.picture)
}

export function deleteRecordedRenderChunks(chunks: RecordedRenderChunk[]): void {
  for (const recorded of chunks) recorded.picture.delete()
}
