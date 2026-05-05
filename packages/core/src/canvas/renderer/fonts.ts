import {
  COMPONENT_LABEL_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  LABEL_FONT_SIZE,
  SECTION_TITLE_FONT_SIZE,
  SIZE_FONT_SIZE
} from '#core/constants'
import { fontManager } from '#core/text/fonts'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { SceneGraph } from '#core/scene-graph'

export function getFontProvider(r: SkiaRenderer) {
  return r.isDestroyed() || !r.fontProvider ? null : r.fontProvider
}

export async function loadFonts(r: SkiaRenderer): Promise<void> {
  if (r.isDestroyed()) return
  r.fontProvider?.delete()
  r.fontProvider = r.ck.TypefaceFontProvider.Make()

  fontManager.attachProvider(r.ck, r.fontProvider)

  const fontData = await fontManager.loadFont(DEFAULT_FONT_FAMILY, 'Regular')
  if (r.isDestroyed()) return
  if (fontData) {
    r.fontProvider.registerFont(fontData, DEFAULT_FONT_FAMILY)
    const typeface = r.ck.Typeface.MakeFreeTypeFaceFromData(fontData)
    if (typeface) {
      r.textFont?.delete()
      r.labelFont?.delete()
      r.sizeFont?.delete()
      r.sectionTitleFont?.delete()
      r.componentLabelFont?.delete()
      r.textFont = new r.ck.Font(typeface, DEFAULT_FONT_SIZE)
      r.labelFont = new r.ck.Font(typeface, LABEL_FONT_SIZE)
      r.sizeFont = new r.ck.Font(typeface, SIZE_FONT_SIZE)
      r.sectionTitleFont = new r.ck.Font(typeface, SECTION_TITLE_FONT_SIZE)
      r.componentLabelFont = new r.ck.Font(typeface, COMPONENT_LABEL_FONT_SIZE)
      r.profiler.setTypeface(typeface)
    }
    r.fontMgr = r.ck.FontMgr.FromData(fontData) ?? null
  }

  r.fontsLoaded = true
  r.invalidateAllPictures()

  void fontManager.ensureCJKFallback().then((families) => {
    if (!r.isDestroyed() && families.length > 0) r.invalidateAllPictures()
  })
  void fontManager.ensureArabicFallback().then((families) => {
    if (!r.isDestroyed() && families.length > 0) r.invalidateAllPictures()
  })
}

export async function prepareForExport(
  r: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[]
): Promise<() => void> {
  const { getTextMeasurer, setTextMeasurer, computeAllLayouts } = await import('#core/layout')

  const previousTextMeasurer = getTextMeasurer()
  setTextMeasurer((node, maxWidth) => r.measureTextNode(node, maxWidth))

  const fontKeys = fontManager.collectFontKeys(graph, nodeIds)
  await Promise.all(fontKeys.map(([family, style]) => fontManager.loadFont(family, style)))

  computeAllLayouts(graph, pageId)

  return () => setTextMeasurer(previousTextMeasurer)
}
