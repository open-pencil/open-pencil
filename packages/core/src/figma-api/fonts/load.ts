import { uniq, uniqBy } from 'es-toolkit/array'

import { faceLoadKey, parseFontStyle } from '@open-pencil/scene-graph/font-style'

import type { FigmaFontNameInput } from '#core/figma-api/fonts/names'
import type { FaceWeight } from '#core/text/font/faces'
import { fontManager } from '#core/text/font/manager'

/**
 * The style name text asks the font manager for, whichever way a script spells it ("Italic",
 * "Semi Bold"), so a font a script loaded is the one its text edits find loaded.
 */
function textFaceStyle(style: string): string {
  const { weight, italic } = parseFontStyle(style)
  return faceLoadKey(weight, italic)
}

/** Figma's rejection for a font it cannot load. */
function fontLoadError(family: string, style: string): Error {
  return new Error(`The font "${family} ${style}" could not be loaded`)
}

/**
 * Loads a font as Figma's `loadFontAsync` does, so text measures and draws with it from then on,
 * and rejects when it cannot load. A family named alone loads every style it has: one style of
 * each slant first, so the rest reuse its file where one variable file draws the whole slant, and
 * then the named styles a variable file draws, which text set by its axes alone takes.
 */
export async function loadFigmaFont({ family, style }: FigmaFontNameInput): Promise<void> {
  if (style !== undefined) {
    const face = textFaceStyle(style)
    await fontManager.loadFont(family, face).catch(() => null)
    if (!fontManager.isStyleLoaded(family, face)) throw fontLoadError(family, style)
    return
  }
  const faces: FaceWeight[] = (await fontManager.familyFaces(family).catch(() => null)) ?? [
    { weight: 400, italic: false }
  ]
  const load = (face: string) => fontManager.loadFont(family, face).catch(() => null)
  const first = uniqBy(faces, (face) => face.italic)
  await Promise.all(first.map((face) => load(faceLoadKey(face.weight, face.italic))))
  await Promise.all(
    faces
      .filter((face) => !first.includes(face))
      .map((face) => load(faceLoadKey(face.weight, face.italic)))
  )
  if (!fontManager.isLoaded(family)) throw fontLoadError(family, 'Regular')
  const named = [false, true].flatMap((italic) =>
    (fontManager.familyVariation(family, italic)?.instances ?? []).map((instance) =>
      faceLoadKey(parseFontStyle(instance.name).weight, italic)
    )
  )
  await Promise.all(uniq(named).map(load))
}
