const FONT_FAMILY_CACHE_LIMIT = 256
const fontFamilyCache = new Map<string, string[]>()

export function getParagraphFontFamilyCache(): Map<string, string[]> {
  return fontFamilyCache
}

export function clearParagraphFontFamilyCache(): void {
  fontFamilyCache.clear()
}

export function paragraphFontFamilyCacheLimit(): number {
  return FONT_FAMILY_CACHE_LIMIT
}
