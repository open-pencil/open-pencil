import type { Canvas } from 'canvaskit-wasm'

import type { MaskType } from '#core/scene-graph'

import type { SkiaRenderer } from './renderer'

function resetMaskPaint(r: SkiaRenderer): void {
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
}

export function renderMaskedChildIds(
  r: SkiaRenderer,
  canvas: Canvas,
  childIds: string[],
  getVisibleMaskType: (childId: string) => MaskType | null,
  renderChild: (childId: string) => void,
  renderMask: (childId: string) => void
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
    try {
      resetMaskPaint(r)
      canvas.save()
      canvas.saveLayer(r.effectLayerPaint)
      for (let maskedIndex = start; maskedIndex < end; maskedIndex++)
        renderChild(childIds[maskedIndex])

      resetMaskPaint(r)
      r.effectLayerPaint.setBlendMode(r.ck.BlendMode.DstIn)
      canvas.saveLayer(r.effectLayerPaint)
      for (const mask of masks) {
        if (mask.type === 'LUMINANCE' && lumaFilter) {
          resetMaskPaint(r)
          r.effectLayerPaint.setColorFilter(lumaFilter)
          canvas.saveLayer(r.effectLayerPaint)
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
