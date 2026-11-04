import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { regionHatchPeriod } from '#core/vector'
import { addLoopToPath } from '#core/vector/path-helpers'

import type { RenderOverlays, SkiaRenderer } from './renderer'

/** Width of a hatch line in screen pixels, as Figma's shaded-region shader covers it. */
const HATCH_LINE_WIDTH = 1.4

/**
 * Figma's shaded regions (`UIRenderShadedRegionsCommand`): 45° lines running "/" in screen space,
 * anchored at the node's origin so they move with it, clipped to each region by its fill rule.
 * The hovered region and the selected ones are hatched.
 */
export function drawRegionHatch(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  editState: NonNullable<RenderOverlays['nodeEditState']>
): void {
  const hatched = new Set(editState.selectedRegions)
  if (editState.hoveredRegion != null) hatched.add(editState.hoveredRegion)
  if (hatched.size === 0) return
  const node = graph.getNode(editState.nodeId)
  if (!node) return

  // The edit session's network is in canvas coordinates; draw it in screen pixels.
  const vertices = editState.vertices.map((v) => ({
    ...v,
    x: v.x * r.zoom + r.panX,
    y: v.y * r.zoom + r.panY
  }))
  const segments = editState.segments.map((s) => ({
    ...s,
    tangentStart: { x: s.tangentStart.x * r.zoom, y: s.tangentStart.y * r.zoom },
    tangentEnd: { x: s.tangentEnd.x * r.zoom, y: s.tangentEnd.y * r.zoom }
  }))
  const [originX, originY] = Matrix.mapPoints(getWorldMatrix(node, graph), [0, 0])
  const ox = originX * r.zoom + r.panX
  const oy = originY * r.zoom + r.panY
  // Lines x + y = c, a period apart across them, so √2 periods apart along either axis.
  const step = regionHatchPeriod(r.zoom) * Math.SQRT2

  const paint = new r.ck.Paint()
  paint.setAntiAlias(true)
  paint.setStyle(r.ck.PaintStyle.Stroke)
  paint.setStrokeWidth(HATCH_LINE_WIDTH)
  paint.setColor(r.selColor())

  for (const index of hatched) {
    const region = editState.regions.at(index)
    if (!region) continue
    const builder = new r.ck.PathBuilder()
    for (const loop of region.loops) addLoopToPath(builder, loop, segments, vertices)
    const path = builder.detachAndDelete()
    // On the detached path: the builder's setFillType returns a copy that nothing deletes.
    path.setFillType(
      region.windingRule === 'EVENODD' ? r.ck.FillType.EvenOdd : r.ck.FillType.Winding
    )
    // Lines only where the region is on screen: a large region would otherwise draw thousands of
    // invisible ones on every hover repaint.
    const [pathLeft, pathTop, pathRight, pathBottom] = path.getBounds()
    const left = Math.max(pathLeft, 0)
    const top = Math.max(pathTop, 0)
    const right = Math.min(pathRight, r.viewportWidth)
    const bottom = Math.min(pathBottom, r.viewportHeight)
    if (left < right && top < bottom) {
      canvas.save()
      canvas.clipPath(path, r.ck.ClipOp.Intersect, true)
      const first = Math.floor((left + top - ox - oy) / step)
      const last = Math.ceil((right + bottom - ox - oy) / step)
      for (let k = first; k <= last; k++) {
        const c = ox + oy + k * step
        canvas.drawLine(c - top, top, c - bottom, bottom, paint)
      }
      canvas.restore()
    }
    path.delete()
  }
  paint.delete()
}
