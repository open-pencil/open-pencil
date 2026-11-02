import { uniqBy } from 'es-toolkit'

import {
  parseFontStyle,
  standardStyleName,
  type ParsedFontStyle
} from '@open-pencil/scene-graph/font-style'

/** A weight, upright or italic. */
export interface FaceWeight {
  weight: number
  italic: boolean
}

/** One face a font family has: a weight, upright or italic, and the name its font gives it. */
export interface FamilyFace extends FaceWeight {
  style: string
}

/**
 * The faces named by a family's style names, such as "Bold Italic" or "Semi Bold", each keeping
 * its name. Of two names for one weight and slant, the first listed is the face's.
 */
export function facesFromStyles(styles: readonly string[]): FamilyFace[] {
  return uniqBy(
    styles.map((style) => ({ ...parseFontStyle(style), style })),
    (face) => `${face.weight}${face.italic ? 'i' : ''}`
  )
}

/** A face named as Google Fonts names it, for a source that gives weights but no names. */
export function standardFace(weight: number, italic: boolean): FamilyFace {
  return { weight, italic, style: standardStyleName(weight, italic) }
}

/** The faces style keys stand for, named as Google Fonts names them. */
export function standardFaces(styles: readonly string[]): FamilyFace[] {
  return facesFromStyles(styles).map((face) => standardFace(face.weight, face.italic))
}

export function hasFamilyFace(faces: readonly FaceWeight[], weight: number, italic: boolean) {
  return faces.some((face) => face.weight === weight && face.italic === italic)
}

/**
 * The face a text takes in a family, as Figma picks it when the family changes: the same weight
 * and slant where the family has it, otherwise the nearest weight with the same slant, or the
 * nearest weight at all in a family without that slant. Equally near weights take the lighter.
 */
export function nearestFamilyFace(
  faces: readonly FamilyFace[],
  weight: number,
  italic: boolean
): FamilyFace | null {
  const sameSlant = faces.filter((face) => face.italic === italic)
  const candidates = sameSlant.length > 0 ? sameSlant : faces
  let nearest: FamilyFace | null = null
  for (const face of candidates) {
    const distance = Math.abs(face.weight - weight)
    const best = nearest ? Math.abs(nearest.weight - weight) : Infinity
    if (distance < best || (distance === best && nearest && face.weight < nearest.weight))
      nearest = face
  }
  return nearest
}

/** A face text asks the font manager for: its family, its style key, and its weight and slant. */
export interface FontFaceRef extends ParsedFontStyle {
  family: string
  style: string
  postscriptName?: string
}

export function fontFaceFromFigmaFontName(fontName: {
  family?: string
  style?: string
  postscript?: string
}): FontFaceRef {
  const style = fontName.style ?? 'Regular'
  return {
    family: fontName.family ?? 'Inter',
    style,
    postscriptName: fontName.postscript,
    ...parseFontStyle(style)
  }
}

export function fontFaceRenderFamily(family: string, style: string): string {
  return `__op_font__${family.replace(/[^a-z0-9_-]+/giu, '_')}__${style.replace(/[^a-z0-9_-]+/giu, '_')}`
}
