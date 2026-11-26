import type { SceneGraph } from '@open-pencil/scene-graph'

import { withWorldViewport } from '#core/canvas/renderer/picture'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'

import type { PlayerScene } from './player'

/** Where a slide sits in a window: as large as fits, in the middle, in CSS pixels. */
export interface SlidePlacement {
  x: number
  y: number
  scale: number
}

/** Places a slide of `width` by `height` as large as fits in the window, in its middle. */
export function placeSlide(
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number
): SlidePlacement {
  const scale = Math.min(viewportWidth / width, viewportHeight / height)
  return {
    x: (viewportWidth - width * scale) / 2,
    y: (viewportHeight - height * scale) / 2,
    scale
  }
}

/**
 * Draws a presentation's scene on the renderer's surface: black around the slides, each slide as
 * large as fits and moved, faded, and darkened as its frame says, its animating layers moved and
 * faded too. The renderer's viewport size and pixel ratio are the window's.
 */
export function drawPresentation(r: SkiaRenderer, graph: SceneGraph, scene: PlayerScene): void {
  r.useDocumentColorSpace(graph.documentColorSpace)
  r.syncFontGeneration()
  r.flushDecodedPreviews(graph)
  graph.clearAbsPosCache()
  const canvas = r.surface.getCanvas()
  canvas.clear(r.ck.BLACK)
  const overlays = { playing: true, layerMotion: scene.layers, playIslands: scene.islands }
  for (const { id, frame } of scene.slides) {
    const slide = graph.getNode(id)
    if (!slide || frame.opacity <= 0) continue
    const place = placeSlide(slide.width, slide.height, r.viewportWidth, r.viewportHeight)
    const width = slide.width * place.scale
    const height = slide.height * place.scale
    canvas.save()
    canvas.scale(r.dpr, r.dpr)
    canvas.translate(place.x + frame.x * width, place.y + frame.y * height)
    canvas.clipRect(r.ck.XYWHRect(0, 0, width, height), r.ck.ClipOp.Intersect, true)
    if (frame.opacity < 1) {
      r.opacityPaint.setAlphaf(frame.opacity)
      canvas.saveLayer(r.opacityPaint)
    }
    canvas.save()
    canvas.scale(place.scale, place.scale)
    r.images.detailScale = place.scale * r.dpr
    // The slide is drawn at its own corner: its place in its row is taken back.
    canvas.translate(-slide.x, -slide.y)
    const absolute = graph.getAbsolutePosition(slide.id)
    const bounds = {
      minX: absolute.x,
      minY: absolute.y,
      maxX: absolute.x + slide.width,
      maxY: absolute.y + slide.height
    }
    const parent = slide.parentId ? graph.getAbsolutePosition(slide.parentId) : { x: 0, y: 0 }
    withWorldViewport(r, bounds, () => {
      r.renderNode(canvas, graph, slide.id, overlays, parent.x, parent.y)
    })
    canvas.restore()
    if (frame.dim > 0) {
      const paint = new r.ck.Paint()
      paint.setColor(r.ck.Color4f(0, 0, 0, frame.dim))
      canvas.drawRect(r.ck.XYWHRect(0, 0, width, height), paint)
      paint.delete()
    }
    if (frame.opacity < 1) canvas.restore()
    canvas.restore()
  }
  r.surface.flush()
}
