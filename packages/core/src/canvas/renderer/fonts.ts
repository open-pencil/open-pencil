import {
  COMPONENT_LABEL_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  LABEL_FONT_SIZE,
  SECTION_TITLE_FONT_SIZE,
  SIZE_FONT_SIZE
} from '#core/constants'

import type { SceneGraph } from '#core/scene-graph'
import type { SkiaRenderer } from '#core/canvas/renderer'

export function getFontProvider(r: SkiaRenderer) {
  return r.fontProvider
}

export async function loadFonts(r: SkiaRenderer): Promise<void> {
  r.fontProvider = r.ck.TypefaceFontProvider.Make()

  const { initFontService, loadFont, ensureArabicFallback, ensureCJKFallback } =
    await import('#core/text/fonts')
  initFontService(r.ck, r.fontProvider)

  const fontData = await loadFont(DEFAULT_FONT_FAMILY, 'Regular')
  if (fontData) {
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

  void ensureCJKFallback().then((families) => {
    if (families.length > 0) r.invalidateAllPictures()
  })
  void ensureArabicFallback().then((families) => {
    if (families.length > 0) r.invalidateAllPictures()
  })
}

export async function prepareForExport(
  r: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[]
): Promise<() => void> {
  const { collectFontKeys, loadFont } = await import('#core/text/fonts')
  const { getTextMeasurer, setTextMeasurer, computeAllLayouts } = await import('#core/layout')

  const previousTextMeasurer = getTextMeasurer()
  setTextMeasurer((node, maxWidth) => r.measureTextNode(node, maxWidth))

  const fontKeys = collectFontKeys(graph, nodeIds)
  await Promise.all(fontKeys.map(([family, style]) => loadFont(family, style)))

  computeAllLayouts(graph, pageId)

  return () => setTextMeasurer(previousTextMeasurer)
}
