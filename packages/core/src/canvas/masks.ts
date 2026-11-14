import type { Canvas } from '@open-pencil/canvaskit'
import type { MaskType } from '@open-pencil/scene-graph'
import { maskRuns } from '@open-pencil/scene-graph/masks'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from './renderer'

function resetMaskPaint(r: SkiaRenderer): void {
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
}

function unionBounds(bounds: Array<Rect | null>): Rect | null {
  let result: Rect | null = null
  for (const bound of bounds) {
    if (!bound) continue
    if (!result) {
      result = { ...bound }
      continue
    }
    const minX = Math.min(result.x, bound.x)
    const minY = Math.min(result.y, bound.y)
    const maxX = Math.max(result.x + result.width, bound.x + bound.width)
    const maxY = Math.max(result.y + result.height, bound.y + bound.height)
    result = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
  return result
}

/** The masks erase everything past what they draw, so only where both draw can show. */
function maskedInBounds(masks: Rect | null, masked: Rect | null): Rect | null {
  if (!masks || !masked) {
    return unionBounds([masks, masked])
  }
  const x = Math.max(masks.x, masked.x)
  const y = Math.max(masks.y, masked.y)
  const right = Math.min(masks.x + masks.width, masked.x + masked.width)
  const bottom = Math.min(masks.y + masks.height, masked.y + masked.height)
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) }
}

/**
 * Draws a container's children bottom to top, each mask run (`maskRuns`) as its masked siblings
 * held to what its masks draw. A run with nothing to mask draws nothing.
 */
export function renderMaskedChildIds(
  r: SkiaRenderer,
  canvas: Canvas,
  childIds: string[],
  getVisibleMaskType: (childId: string) => MaskType | null,
  renderChild: (childId: string) => void,
  renderMask: (childId: string) => void,
  getChildBounds?: (childId: string) => Rect | null
): void {
  let next = 0
  for (const run of maskRuns(childIds, (childId) => getVisibleMaskType(childId) !== null)) {
    for (; next < run.start; next++) renderChild(childIds[next])
    next = run.end
    if (run.maskedStart === run.end) continue
    const masks = childIds.slice(run.start, run.maskedStart).flatMap((id) => {
      const type = getVisibleMaskType(id)
      return type ? [{ id, type }] : []
    })
    const masked = childIds.slice(run.maskedStart, run.end)
    drawMaskRun(r, canvas, masks, masked, renderChild, renderMask, getChildBounds)
  }
  for (; next < childIds.length; next++) renderChild(childIds[next])
}

function drawMaskRun(
  r: SkiaRenderer,
  canvas: Canvas,
  masks: Array<{ id: string; type: MaskType }>,
  masked: string[],
  renderChild: (childId: string) => void,
  renderMask: (childId: string) => void,
  getChildBounds?: (childId: string) => Rect | null
): void {
  const lumaFilter = masks.some((mask) => mask.type === 'LUMINANCE')
    ? r.ck.ColorFilter.MakeLuma()
    : null
  const bounds = getChildBounds
    ? maskedInBounds(
        unionBounds(masks.map((mask) => getChildBounds(mask.id))),
        unionBounds(masked.map((id) => getChildBounds(id)))
      )
    : null
  const layerBounds = bounds
    ? r.ck.LTRBRect(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height)
    : undefined
  try {
    resetMaskPaint(r)
    canvas.save()
    canvas.saveLayer(r.effectLayerPaint, layerBounds)
    for (const id of masked) renderChild(id)

    resetMaskPaint(r)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.DstIn)
    canvas.saveLayer(r.effectLayerPaint, layerBounds)
    for (const mask of masks) {
      if (mask.type === 'LUMINANCE' && lumaFilter) {
        resetMaskPaint(r)
        r.effectLayerPaint.setColorFilter(lumaFilter)
        canvas.saveLayer(r.effectLayerPaint, layerBounds)
        renderMask(mask.id)
        // Skia's luma is that of the premultiplied color; Figma also scales it by the mask's
        // alpha, so a mask at half opacity shows a quarter of what it masks.
        resetMaskPaint(r)
        r.effectLayerPaint.setBlendMode(r.ck.BlendMode.DstIn)
        canvas.saveLayer(r.effectLayerPaint, layerBounds)
        renderMask(mask.id)
        canvas.restore()
        canvas.restore()
        continue
      }
      renderMask(mask.id)
    }
    canvas.restore()

    canvas.restore()
    canvas.restore()
  } finally {
    resetMaskPaint(r)
    lumaFilter?.delete()
  }
}
