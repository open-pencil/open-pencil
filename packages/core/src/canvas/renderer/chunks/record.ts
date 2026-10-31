import type { Canvas, SkPicture } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { recordWorldPicture, withWorldViewport } from '#core/canvas/renderer/picture'
import { clipNodeShape, withNodeOutline } from '#core/canvas/shapes'

import type { RenderChunk } from './index'

export interface RecordedRenderChunk {
  chunk: RenderChunk
  picture: SkPicture
}

/**
 * Clips to an ancestor's outline in world space. A frame that is only translated, the common
 * case, clips its box or rounded box moved into place, one call; a rotated, flipped, or scaled
 * one clips under its matrix and restores it.
 */
function clipAncestor(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph, node: SceneNode): void {
  const world = getWorldMatrix(node, graph)
  const translated = world[0] === 1 && world[1] === 0 && world[3] === 0 && world[4] === 1
  if (translated) {
    const tx = world[2]
    const ty = world[5]
    const clipped = withNodeOutline(r, node, (outline) => {
      if (outline.kind === 'rect') {
        canvas.clipRect(
          r.ltrb(tx, ty, tx + node.width, ty + node.height),
          r.ck.ClipOp.Intersect,
          true
        )
        return true
      }
      if (outline.kind === 'rrect') {
        const rrect = outline.rrect.slice()
        rrect[0] += tx
        rrect[1] += ty
        rrect[2] += tx
        rrect[3] += ty
        canvas.clipRRect(rrect, r.ck.ClipOp.Intersect, true)
        return true
      }
      return false
    })
    if (clipped) return
  }
  canvas.concat(world)
  clipNodeShape(r, canvas, node)
  const inverse = Matrix.invert(world)
  if (inverse) canvas.concat(inverse)
}

function drawChunkContent(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  chunk: RenderChunk
): void {
  canvas.save()
  const { clipRect } = chunk.context
  if (clipRect) {
    canvas.clipRect(
      r.ltrb(clipRect.minX, clipRect.minY, clipRect.maxX, clipRect.maxY),
      r.ck.ClipOp.Intersect,
      true
    )
  }
  for (const ancestorId of chunk.context.ancestorClipIds) {
    const ancestor = graph.getNode(ancestorId)
    if (ancestor) clipAncestor(r, canvas, graph, ancestor)
  }
  canvas.concat(chunk.context.parentTransform)
  if (chunk.kind === 'self') r.renderNodeSelf(canvas, graph, chunk.nodeId)
  else r.renderNode(canvas, graph, chunk.nodeId, {}, 0, 0, chunk.context.parentTransform)
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
