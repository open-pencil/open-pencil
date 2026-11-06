import type { PenFont } from '@open-pencil/pen'
import type { FontFamilyStyle } from '@open-pencil/scene-graph/font-style'

import { fontManager } from '#core/text/font/manager'
import { fontFaceName } from '#core/text/font/variation'
import { sfntFont } from '#core/text/font/woff2'

/**
 * Registers the fonts a `.pen` document bundles, each under the family and style its file names
 * itself with, and returns those names by the `name` the document's text uses for it. pen.dev
 * gives a bundled file a name of its own, such as `Geist-SemiBold`, which no font list knows; the
 * text then reads as Geist SemiBold, as Figma and the font manager name it. A font whose file
 * cannot be read keeps its name, and its text is substituted as a missing font is.
 */
export async function loadPenFonts(
  fonts: readonly PenFont[],
  read: (url: string) => Promise<Uint8Array | null>
): Promise<Map<string, FontFamilyStyle>> {
  const faces = new Map<string, FontFamilyStyle>()
  await Promise.all(
    fonts.map(async ({ name, url }) => {
      const bytes = await read(url)
      if (!bytes) return
      try {
        const data = await sfntFont(bytes.slice().buffer)
        const face = fontFaceName(data)
        if (!face) return
        await fontManager.markLoaded(face.family, face.style, data)
        faces.set(name, face)
      } catch (error) {
        // Its text stays in the font it names, substituted as a missing font is.
        console.warn(`Bundled font "${name}" could not be read:`, error)
      }
    })
  )
  return faces
}
