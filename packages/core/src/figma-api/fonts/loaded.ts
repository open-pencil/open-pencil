import { uniqBy } from 'es-toolkit/array'

import type { CharacterStyleOverride, SceneNode } from '@open-pencil/scene-graph'

import { fontManager } from '#core/text/font/manager'
import { textFaceName } from '#core/text/font/names'
import { textFontFace } from '#core/text/requirements/collect'

/** A face text draws in, and its name as Figma names it in its messages. */
interface DescribedFace {
  family: string
  /** The style the font manager loads the face as. */
  loadStyle: string
  /** The face's own name, as `fontName` reads it. */
  style: string
}

/** The face characters with `style` over the text draw in, named as the text names it. */
function describedFace(node: SceneNode, style: CharacterStyleOverride = {}): DescribedFace {
  const face = textFontFace(node, style)
  return { family: face.family, loadStyle: face.style, style: textFaceName(node, style) }
}

function loadHint({ family, style }: DescribedFace): string {
  return `Please call figma.loadFontAsync({ family: "${family}", style: "${style}" }) and await the returned promise first.`
}

function isLoaded(face: DescribedFace): boolean {
  return fontManager.isStyleLoaded(face.family, face.loadStyle)
}

/** Every face the text draws in: its own and each style run's. */
function textFaces(node: SceneNode): DescribedFace[] {
  const faces = [
    describedFace(node),
    ...node.styleRuns.map((run) => describedFace(node, run.style))
  ]
  return uniqBy(faces, (face) => `${face.family}\0${face.loadStyle}`)
}

/**
 * Figma refuses an edit that lays text out again until every font the text uses is loaded, so
 * the text is never measured in a stand-in font. Paints and links need no font. Callers check
 * the edit's own arguments first, as Figma does.
 */
export function assertTextFontsLoaded(method: string, node: SceneNode): void {
  const font = textFaces(node).find((face) => !isLoaded(face))
  if (!font) return
  throw new Error(
    `in ${method}: Cannot write to node with unloaded font "${font.family} ${font.style}". ${loadHint(font)}`
  )
}

/** Figma refuses a font that is not loaded yet, before it checks the text's own. */
export function assertFontLoaded(
  method: string,
  node: SceneNode,
  style: CharacterStyleOverride
): void {
  const font = describedFace(node, style)
  if (isLoaded(font)) return
  throw new Error(
    `in ${method}: Cannot use unloaded font "${font.family} ${font.style}". ${loadHint(font)}`
  )
}
