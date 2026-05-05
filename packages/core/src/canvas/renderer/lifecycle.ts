import { resetFontService } from '#core/text/fonts'

import type { SkiaRenderer } from '#core/canvas/renderer'

export function destroyRenderer(r: SkiaRenderer): void {
  if (r.destroyed) return
  r.destroyed = true

  for (const img of r.imageCache.values()) img.delete()
  r.imageCache.clear()
  for (const cache of [r.vectorPathCache, r.fillGeometryCache, r.strokeGeometryCache]) {
    for (const paths of cache.values()) {
      for (const p of paths) p.delete()
    }
    cache.clear()
  }
  r.fillPaint.delete()
  r.strokePaint.delete()
  r.selectionPaint.delete()
  r.snapPaint.delete()
  r.auxFill.delete()
  r.auxStroke.delete()
  r.opacityPaint.delete()
  r.textFont?.delete()
  r.labelFont?.delete()
  r.sizeFont?.delete()
  r.fontMgr?.delete()
  const fontProvider = r.fontProvider
  fontProvider?.delete()
  r.fontProvider = null
  r.fontsLoaded = false
  resetFontService(fontProvider)
  r.rulerBgPaint.delete()
  r.rulerTickPaint.delete()
  r.rulerTextPaint.delete()
  r.rulerHlPaint.delete()
  r.rulerBadgePaint.delete()
  r.rulerLabelPaint.delete()
  r.penPathPaint.delete()
  r.penLiveStrokePaint.delete()
  r.penHandlePaint.delete()
  r.penVertexFill.delete()
  r.penVertexStroke.delete()
  r.effectLayerPaint.delete()
  for (const filter of r.imageFilterCache.values()) filter?.delete()
  r.imageFilterCache.clear()
  for (const filter of r.maskFilterCache.values()) filter?.delete()
  r.maskFilterCache.clear()
  for (const pic of r.nodePictureCache.values()) pic?.delete()
  r.nodePictureCache.clear()
  r.scenePicture?.delete()
  r._flashPaint?.delete()
  r.profiler.destroy()
  r.surface.delete()
}
