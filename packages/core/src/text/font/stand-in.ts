import { fontTableView } from '#core/text/font/variation'

/**
 * An open font drawn in place of a family nobody may ship, sized and set in that family's line
 * box so text wraps and stacks as it does in it. The document keeps the family's own name, so the
 * real font draws it wherever it is installed.
 */
export interface FontStandIn {
  /** The open family drawn in its place, as the font status names it. */
  family: string
  /** The bundled file that draws it. */
  file: string
  /** How much larger it is drawn, so its letters take the widths the family's do. */
  scale: number
  /** The family's line box above and below the baseline, in ems. */
  ascent: number
  descent: number
}

/**
 * Families drawn by a stand-in when they are not installed. FigJam's "Cute" typeface is Figma
 * Hand, which OH no Type licensed for Figma's own products only. Measured in Figma on 2026-11-01
 * against 25 open handwriting fonts, Caveat is the nearest: drawn 1.69 times larger its lines
 * take Figma Hand's widths, and Figma Hand's line box is 1.38 em, 1.02 of it above the baseline.
 */
export const FONT_STAND_INS: Readonly<Record<string, FontStandIn>> = {
  'Figma Hand': {
    family: 'Caveat',
    file: '/CaveatVariable.woff2',
    scale: 1.69,
    ascent: 1.02,
    descent: 0.36
  }
}

/** The stand-in that draws `family` when it is missing, if it has one. */
export function fontStandIn(family: string): FontStandIn | null {
  return Object.hasOwn(FONT_STAND_INS, family) ? FONT_STAND_INS[family] : null
}

/**
 * `font` (an sfnt file) made to draw as `standIn` asks: a smaller em, so every glyph, advance and
 * kerning value is `scale` times larger at the same font size, and the family's ascent and descent
 * in all three places fonts give them, with no line gap. The outlines stay as they are. `null` when
 * `font` is not a font, as a host that answers a missing file with a page would give.
 */
export function standInFont(font: ArrayBuffer, standIn: FontStandIn): ArrayBuffer | null {
  const data = font.slice(0)
  const head = fontTableView(data, 'head')
  const hhea = fontTableView(data, 'hhea')
  // The fields read and written: the em in `head`, the line metrics in `hhea`.
  if (!head || !hhea || head.byteLength < 20 || hhea.byteLength < 10) return null
  const unitsPerEm = Math.round(head.getUint16(18) / standIn.scale)
  const ascent = Math.round(standIn.ascent * unitsPerEm)
  const descent = Math.round(standIn.descent * unitsPerEm)
  head.setUint16(18, unitsPerEm)
  hhea.setInt16(4, ascent)
  hhea.setInt16(6, -descent)
  hhea.setInt16(8, 0)
  const os2 = fontTableView(data, 'OS/2')
  if (os2 && os2.byteLength >= 78) {
    os2.setInt16(68, ascent)
    os2.setInt16(70, -descent)
    os2.setInt16(72, 0)
    os2.setUint16(74, ascent)
    os2.setUint16(76, descent)
  }
  return data
}
