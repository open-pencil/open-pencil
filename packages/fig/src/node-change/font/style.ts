import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { CharacterStyleOverride, SceneNode } from '@open-pencil/scene-graph'
import {
  normalizeFontFamily,
  parseFontStyle,
  standardStyleName
} from '@open-pencil/scene-graph/font-style'
import { rangeFontStyle } from '@open-pencil/scene-graph/shared-styles'

/** The name a family's font gives its face at a weight and slant. */
export type StyleNamer = (family: string, weight: number, italic: boolean) => string

/** Names a face as Google Fonts does, for a writer that cannot read the fonts. */
export const standardStyleNamer: StyleNamer = (_family, weight, italic) =>
  standardStyleName(weight, italic)

/**
 * Figma's names for faces of a font Figma ships in another version than ours, by family and our
 * name. Figma finds a face by its exact name, and its Inter is Inter 3, which spaces the names
 * our Inter 4 joins (measured 2026-10-28).
 */
const FIGMA_STYLE_NAMES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Inter: {
    ExtraLight: 'Extra Light',
    'ExtraLight Italic': 'Extra Light Italic',
    SemiBold: 'Semi Bold',
    'SemiBold Italic': 'Semi Bold Italic',
    ExtraBold: 'Extra Bold',
    'ExtraBold Italic': 'Extra Bold Italic'
  }
}

/**
 * The face name characters with `style` over the text are saved under, which Figma finds their
 * font's face by: the name they were given, else the font's own for their weight and slant.
 */
export function figmaStyleName(
  node: SceneNode,
  style: CharacterStyleOverride,
  nameFace: StyleNamer
): string {
  const family = style.fontFamily ?? node.fontFamily
  const own = rangeFontStyle(node, style)
  const name =
    own ?? nameFace(family, style.fontWeight ?? node.fontWeight, style.italic ?? node.italic)
  return FIGMA_STYLE_NAMES[normalizeFontFamily(family)]?.[name] ?? name
}

/**
 * The weight and slant of the face `fontName` names in `text`, as Figma saved them beside its
 * glyphs (Avenir Book 350, Fira Code Retina 450, Roboto Condensed Bold 700); the name's own
 * words where the file saved no glyphs.
 */
export function savedFace(
  text: NodeChange,
  fontName: { family: string; style: string }
): { fontWeight: number; italic: boolean } {
  const meta = text.derivedTextData?.fontMetaData?.find(
    ({ key }) => key.family === fontName.family && key.style === fontName.style
  )
  if (meta?.fontWeight !== undefined) {
    return { fontWeight: meta.fontWeight, italic: meta.fontStyle === 'ITALIC' }
  }
  const { weight, italic } = parseFontStyle(fontName.style)
  return { fontWeight: weight, italic }
}
