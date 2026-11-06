import type { FigmaFont } from '#core/figma-api/fonts/names'
import { fontManager } from '#core/text/font/manager'

/**
 * Every face a script can set, as Figma's `listAvailableFontsAsync` lists them: each family's
 * faces as far as they are known, from its installed, bundled, or web fonts. Listing families can
 * forget the faces found so far (the first request for local fonts does), so a family whose faces
 * were found before, or a font is loaded from, is looked up again. A web family nobody has looked
 * up is listed as `Regular`, since its faces take a request each.
 */
export async function listFigmaFonts(): Promise<FigmaFont[]> {
  const found = new Set(fontManager.familiesWithFoundFaces())
  const families = await fontManager.listFamilyOptions()
  await Promise.all(
    families
      .filter(({ family }) => found.has(family) || fontManager.isLoaded(family))
      .map(({ family }) => fontManager.familyFaces(family).catch(() => null))
  )
  return families.flatMap(({ family }) => {
    const faces = fontManager.familyFacesSync(family)
    const styles = faces?.length ? faces.map(({ style }) => style) : ['Regular']
    return styles.map((style) => ({ fontName: { family, style } }))
  })
}
