import { uniqBy } from 'es-toolkit/array'

import type { SceneNode } from '@open-pencil/scene-graph'

import { weightToStyleName } from '#core/figma-api/fonts'
import type { FontFaceRef } from '#core/text/face'
import { fontManager } from '#core/text/fonts'
import { textFontFace } from '#core/text/requirements'

/**
 * A face as Figma names it in its messages, as `fontName` reads it: "Semi Bold", not "SemiBold",
 * and a weight between named ones by the nearest, as the font manager loads it.
 */
function described(face: FontFaceRef): { family: string; style: string } {
  const weight = Math.round(face.weight / 100) * 100
  return { family: face.family, style: weightToStyleName(weight, face.italic) }
}

function loadHint({ family, style }: { family: string; style: string }): string {
  return `Please call figma.loadFontAsync({ family: "${family}", style: "${style}" }) and await the returned promise first.`
}

function isLoaded(face: FontFaceRef): boolean {
  return fontManager.isStyleLoaded(face.family, face.style)
}

/** Every face the text draws in: its own and each style run's. */
function textFaces(node: SceneNode): FontFaceRef[] {
  const faces = [textFontFace(node), ...node.styleRuns.map((run) => textFontFace(node, run.style))]
  return uniqBy(faces, (face) => `${face.family}\0${face.style}`)
}

/**
 * Figma refuses an edit that lays text out again until every font the text uses is loaded, so
 * the text is never measured in a stand-in font. Paints and links need no font. Callers check
 * the edit's own arguments first, as Figma does.
 */
export function assertTextFontsLoaded(method: string, node: SceneNode): void {
  const unloaded = textFaces(node).find((face) => !isLoaded(face))
  if (!unloaded) return
  const font = described(unloaded)
  throw new Error(
    `in ${method}: Cannot write to node with unloaded font "${font.family} ${font.style}". ${loadHint(font)}`
  )
}

/** Figma refuses a font that is not loaded yet, before it checks the text's own. */
export function assertFontLoaded(method: string, face: FontFaceRef): void {
  if (isLoaded(face)) return
  const font = described(face)
  throw new Error(
    `in ${method}: Cannot use unloaded font "${font.family} ${font.style}". ${loadHint(font)}`
  )
}
