import { uniqBy } from 'es-toolkit/array'

import type { CharacterStyleOverride, SceneNode } from '@open-pencil/scene-graph'
import {
  parseFontStyle,
  standardStyleName,
  styleSpelling
} from '@open-pencil/scene-graph/font-style'
import { rangeFontStyle } from '@open-pencil/scene-graph/shared-styles'

import type { FamilyFace } from '#core/text/font/faces'
import { fontManager } from '#core/text/font/manager'
import { textFontFace } from '#core/text/requirements/collect'

/** A text's or a character's face: its family, weight, and slant, and the name it was given. */
export type TextFace = Pick<SceneNode, 'fontFamily' | 'fontWeight' | 'italic' | 'fontStyle'>

/**
 * The name the family's font gives its face at `weight` and slant, as Figma names a face; the
 * standard name while the family's faces are unknown or it has no such face.
 */
export function faceStyleName(family: string, weight: number, italic: boolean): string {
  const face = fontManager
    .familyFacesSync(family)
    ?.find((candidate) => candidate.weight === weight && candidate.italic === italic)
  return face?.style ?? standardStyleName(weight, italic)
}

/** The name of the face a text draws in: the one it was given, else its font's own. */
export function textStyleName(style: TextFace): string {
  return style.fontStyle ?? faceStyleName(style.fontFamily, style.fontWeight, style.italic)
}

/**
 * The named instance of that name in the family's loaded variable font, in either slant, as a
 * face at its instance's weight ("Condensed Bold" at 700, "Retina" at 450).
 */
function instanceFace(family: string, style: string): FamilyFace | null {
  for (const italic of [false, true]) {
    const instance = fontManager
      .familyVariation(family, italic)
      ?.instances.find((candidate) => styleSpelling(candidate.name) === styleSpelling(style))
    const weight = instance?.variations.find(({ axis }) => axis === 'wght')?.value
    if (instance && weight !== undefined) return { weight, italic, style: instance.name }
  }
  return null
}

/**
 * The face `style` names in the family, by the family's own name for it, where the family names
 * it alike but for case and spaces, as Inter 3's "Semi Bold" names Inter 4's "SemiBold"; else
 * the named instance of that name in its loaded variable font. Of two faces of one name, as an
 * upright and an italic file can both name an instance "Bold", the one in `italic`'s slant is
 * it. A name neither holds, or while the family is unknown, stays as asked, with the weight and
 * slant its words stand for.
 */
export function faceForStyle(family: string, style: string, italic?: boolean): FamilyFace {
  const named = (fontManager.familyFacesSync(family) ?? []).filter(
    (candidate) => styleSpelling(candidate.style) === styleSpelling(style)
  )
  const face =
    named.find((candidate) => candidate.italic === italic) ??
    named.find((candidate) => candidate.style === style) ??
    named.at(0) ??
    instanceFace(family, style)
  return face ?? { ...parseFontStyle(style), style }
}

/** The name of the face characters with `style` over the text draw in, as the text names it. */
export function textFaceName(node: SceneNode, style: CharacterStyleOverride = {}): string {
  const face = textFontFace(node, style)
  return textStyleName({
    fontFamily: face.family,
    fontWeight: face.weight,
    italic: face.italic,
    fontStyle: rangeFontStyle(node, style)
  })
}

/** Each face a text draws in, with the style it loads as and its name, once per name. */
export function collectNamedNodeFontFaces(
  node: SceneNode
): Array<{ family: string; style: string; name: string }> {
  if (node.type !== 'TEXT') return []
  const styles: CharacterStyleOverride[] = [{}, ...node.styleRuns.map((run) => run.style)]
  const faces = styles.map((style) => {
    const { family, style: load } = textFontFace(node, style)
    return { family, style: load, name: textFaceName(node, style) }
  })
  return uniqBy(faces, (face) => `${face.family}\0${face.style}\0${face.name}`)
}
