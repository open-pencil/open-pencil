import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { FigmaDerivedTextGlyph } from '@open-pencil/scene-graph'

export function convertFigmaDerivedTextGlyphs(
  derivedTextData: NodeChange['derivedTextData'],
  blobs: Uint8Array[]
): FigmaDerivedTextGlyph[] {
  return (derivedTextData?.glyphs ?? [])
    .map((glyph) => {
      if (glyph.commandsBlob === undefined) return null
      return {
        commandsBlob: blobs[glyph.commandsBlob],
        x: glyph.position.x,
        y: glyph.position.y,
        fontSize: glyph.fontSize,
        // Figma Glyph.rotation is radians (path text uses non-zero values).
        rotation: glyph.rotation ?? 0
      }
    })
    .filter((glyph): glyph is NonNullable<typeof glyph> => !!glyph)
}
