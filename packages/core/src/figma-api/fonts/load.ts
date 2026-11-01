import { uniq, uniqBy } from 'es-toolkit/array'

import { faceStyleKey, namesWeight, styleSpelling } from '@open-pencil/scene-graph/font-style'

import type { FigmaFontNameInput } from '#core/figma-api/fonts/names'
import type { FamilyFace } from '#core/text/font/faces'
import { fontManager } from '#core/text/font/manager'
import { faceForStyle } from '#core/text/font/names'
import { hasNamedInstance } from '#core/text/font/variation'

/** Figma's rejection for a font it cannot load. */
function fontLoadError(family: string, style: string): Error {
  return new Error(`The font "${family} ${style}" could not be loaded`)
}

/** The key a face loads under, as text set in it asks for it. */
function faceKey(face: FamilyFace): string {
  return faceStyleKey({ fontWeight: face.weight, italic: face.italic, fontStyle: face.style })
}

/**
 * Whether the family has the face `style` names, as Figma requires of a font it loads: one of
 * the faces its fonts list, or a named instance of the variable font loaded for it. A family
 * whose faces are unknown has whatever face loaded.
 */
function familyHasFace(
  family: string,
  style: string,
  key: string,
  faces: readonly FamilyFace[] | null
): boolean {
  if (!faces) return true
  if (faces.some((face) => styleSpelling(face.style) === styleSpelling(style))) return true
  const data = fontManager.loadedData(family, key)
  return data !== null && hasNamedInstance(data, style)
}

/**
 * Loads a font as Figma's `loadFontAsync` does, so text measures and draws with it from then on,
 * and rejects a face that cannot load or that the family does not have. A family named alone
 * loads every face it has: one of each slant first, so the rest reuse its file where one
 * variable file draws the whole slant, and then the named instances a variable file draws,
 * which text set by its axes alone takes.
 */
export async function loadFigmaFont({ family, style }: FigmaFontNameInput): Promise<void> {
  const faces = await fontManager.familyFaces(family).catch(() => null)
  if (style !== undefined) {
    const key = faceKey(faceForStyle(family, style))
    await fontManager.loadFont(family, key).catch(() => null)
    if (!fontManager.isStyleLoaded(family, key) || !familyHasFace(family, style, key, faces)) {
      throw fontLoadError(family, style)
    }
    return
  }
  const listed = faces ?? [{ weight: 400, italic: false, style: 'Regular' }]
  const load = (key: string) => fontManager.loadFont(family, key).catch(() => null)
  const first = uniqBy(listed, (face) => face.italic)
  await Promise.all(first.map((face) => load(faceKey(face))))
  await Promise.all(
    listed.filter((face) => !first.includes(face)).map((face) => load(faceKey(face)))
  )
  if (!fontManager.isLoaded(family)) throw fontLoadError(family, 'Regular')
  const named = [false, true].flatMap((italic) =>
    (fontManager.familyVariation(family, italic)?.instances ?? []).map((instance) =>
      faceStyleKey({
        fontWeight: instance.variations.find(({ axis }) => axis === 'wght')?.value ?? 400,
        italic,
        // An instance that only names a weight is that weight in this file's slant.
        fontStyle: namesWeight(instance.name) ? null : instance.name
      })
    )
  )
  await Promise.all(uniq(named).map(load))
}
