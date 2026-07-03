import type { Canvas } from 'canvaskit-wasm'

import type { MaskType } from '@open-pencil/scene-graph'
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

export function renderMaskedChildIds(
  r: SkiaRenderer,
  canvas: Canvas,
  childIds: string[],
  getVisibleMaskType: (childId: string) => MaskType | null,
  renderChild: (childId: string) => void,
  renderMask: (childId: string) => void,
  getChildBounds?: (childId: string) => Rect | null
): void {
  for (let index = 0; index < childIds.length; index++) {
    const childId = childIds[index]
    const firstMaskType = getVisibleMaskType(childId)
    if (!firstMaskType) {
      renderChild(childId)
      continue
    }

    const masks: Array<{ id: string; type: MaskType }> = []
    let maskIndex = index
    while (maskIndex < childIds.length) {
      const maskType = getVisibleMaskType(childIds[maskIndex])
      if (!maskType) break
      masks.push({ id: childIds[maskIndex], type: maskType })
      maskIndex++
    }

    const start = maskIndex
    let end = start
    while (end < childIds.length && !getVisibleMaskType(childIds[end])) end++
    if (start === end) {
      index = maskIndex - 1
      continue
    }

    const lumaFilter = masks.some((mask) => mask.type === 'LUMINANCE')
      ? r.ck.ColorFilter.MakeLuma()
      : null
    const bounds = getChildBounds
      ? unionBounds([
          ...masks.map((mask) => getChildBounds(mask.id)),
          ...childIds.slice(start, end).map((id) => getChildBounds(id))
        ])
      : null
    const layerBounds = bounds
      ? r.ck.LTRBRect(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height)
      : undefined
    try {
      resetMaskPaint(r)
      canvas.save()
      canvas.saveLayer(r.effectLayerPaint, layerBounds)
      for (let maskedIndex = start; maskedIndex < end; maskedIndex++)
        renderChild(childIds[maskedIndex])

      resetMaskPaint(r)
      r.effectLayerPaint.setBlendMode(r.ck.BlendMode.DstIn)
      canvas.saveLayer(r.effectLayerPaint, layerBounds)
      for (const mask of masks) {
        if (mask.type === 'LUMINANCE' && lumaFilter) {
          resetMaskPaint(r)
          r.effectLayerPaint.setColorFilter(lumaFilter)
          canvas.saveLayer(r.effectLayerPaint, layerBounds)
          renderMask(mask.id)
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
    index = end - 1
  }
}
