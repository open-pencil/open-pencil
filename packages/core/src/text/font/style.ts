import { normalizeFontFamily } from '@open-pencil/scene-graph'
import type { FontFamilyStyle } from '@open-pencil/scene-graph'

export {
  FONT_WEIGHT_NAMES,
  normalizeFontFamily,
  styleToVariant,
  styleToWeight,
  weightToStyle
} from '@open-pencil/scene-graph'

import { parseFontStyle } from '#core/text/face'

export function chooseLocalFontMatch<T extends FontFamilyStyle>(
  fonts: T[],
  family: string,
  style?: string
): T | undefined {
  const families = [family]
  const normalized = normalizeFontFamily(family)
  if (normalized !== family) families.push(normalized)
  const requested = parseFontStyle(style)

  for (const candidateFamily of families) {
    const exact = style
      ? fonts.find((font) => font.family === candidateFamily && font.style === style)
      : undefined
    if (exact) return exact

    const candidates = fonts.filter((font) => font.family === candidateFamily)
    const sameStyle = candidates.find((font) => {
      const parsed = parseFontStyle(font.style)
      return parsed.weight === requested.weight && parsed.italic === requested.italic
    })
    if (sameStyle) return sameStyle
    if (style) continue

    const sameSlant = candidates.filter(
      (font) => parseFontStyle(font.style).italic === requested.italic
    )
    if (sameSlant.length > 0) return sameSlant[0]
    if (candidates.length > 0) return candidates[0]
  }

  return undefined
}

export function isVariableFont(data: ArrayBuffer): boolean {
  if (data.byteLength < 12) return false
  const view = new DataView(data)
  const numTables = view.getUint16(4)
  for (let i = 0; i < numTables && 12 + i * 16 + 4 <= data.byteLength; i++) {
    const tag = String.fromCharCode(
      view.getUint8(12 + i * 16),
      view.getUint8(12 + i * 16 + 1),
      view.getUint8(12 + i * 16 + 2),
      view.getUint8(12 + i * 16 + 3)
    )
    if (tag === 'fvar') return true
  }
  return false
}

export { weightToFigmaStyle } from '@open-pencil/fig/node-change'
