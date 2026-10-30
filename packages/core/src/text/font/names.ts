import { uniqBy } from 'es-toolkit/array'

import type { CharacterStyleOverride, SceneNode } from '@open-pencil/scene-graph'
import { parseFontStyle, standardStyleName } from '@open-pencil/scene-graph/font-style'
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

/** A name compared without case or spaces, so "Semi Bold" and "SemiBold" name one face. */
function spellingKey(style: string): string {
  return style.toLowerCase().replace(/\s+/gu, '')
}

/**
 * The face `style` names in the family, by the family's own name for it, where the family names
 * it alike but for case and spaces, as Inter 3's "Semi Bold" names Inter 4's "SemiBold". A name
 * the family's faces do not hold, or while they are unknown, stays as asked, with the weight and
 * slant its words stand for.
 */
export function faceForStyle(family: string, style: string): FamilyFace {
  const faces = fontManager.familyFacesSync(family) ?? []
  const face =
    faces.find((candidate) => candidate.style === style) ??
    faces.find((candidate) => spellingKey(candidate.style) === spellingKey(style))
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
