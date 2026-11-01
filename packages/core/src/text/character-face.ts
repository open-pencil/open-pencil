import type { SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY } from '#core/constants'

import { drawnFontVariations, loadedFace, paragraphSourceFamilies } from './font/families'
import { glyphOutlineSourceSync, shardCovers, shardOutlineSources } from './font/glyphs'
import { fontManager } from './font/manager'
import { textFontFace } from './requirements/collect'

/** The loaded face of a family the paragraph draws a face in, as its key. */
function loadedStyle(
  family: string,
  weight: number,
  italic: boolean,
  style: string
): string | null {
  return loadedFace(family, weight, italic, style)?.style ?? null
}

/**
 * The font a character asks for: its family, weight, and slant, and the variable axes it sets;
 * and the face the paragraph asks every family for, the one its own family has loaded, as
 * `drawnFontStyle` asks CanvasKit.
 */
export function fontAt(node: SceneNode, index: number) {
  const run = styleRunAt(node, index)
  const family = run?.style.fontFamily ?? (node.fontFamily || DEFAULT_FONT_FAMILY)
  const weight = run?.style.fontWeight ?? node.fontWeight
  const italic = run?.style.italic ?? node.italic
  const style = textFontFace(node, run?.style).style
  const variations = drawnFontVariations({
    family,
    weight,
    italic,
    style,
    fontSize: run?.style.fontSize ?? node.fontSize,
    variations: run?.style.fontVariations ?? node.fontVariations,
    opticalSizeFromFontSize: run?.style.opticalSizeFromFontSize ?? node.opticalSizeFromFontSize
  })
  const drawn = loadedFace(family, weight, italic, style) ?? { weight, italic, style }
  return { family, weight, italic, style, variations, drawn }
}

export type StyleRun = SceneNode['styleRuns'][number]

export function styleRunAt(node: SceneNode, index: number): StyleRun | undefined {
  return node.styleRuns.find((item) => index >= item.start && index < item.start + item.length)
}

/**
 * The style a family of the paragraph is drawn in: the face its own family draws the asked style
 * in, and Regular for the Arabic and CJK fallbacks, as the paragraph asks CanvasKit for them.
 */
function sourceStyle(family: string, font: ReturnType<typeof fontAt>): string | null {
  const scriptFallback =
    family !== font.family &&
    (fontManager.getArabicFallbackFamilies().includes(family) ||
      fontManager.getCJKFallbackFamilies().includes(family))
  if (scriptFallback) return fontManager.isStyleLoaded(family, 'Regular') ? 'Regular' : null
  return loadedStyle(family, font.drawn.weight, font.drawn.italic, font.drawn.style)
}

/**
 * The outline source of each file the paragraph may have drawn a character in, in its order:
 * each family's own file, then its shards.
 */
export function* candidateSources(font: ReturnType<typeof fontAt>) {
  for (const family of paragraphSourceFamilies(font.family)) {
    const style = sourceStyle(family, font)
    if (!style) continue
    const source = glyphOutlineSourceSync(family, style, font.variations)
    if (source) yield source
    yield* shardOutlineSources(family, style, font.variations)
  }
}

/** The face and file the paragraph draws a character in. */
export interface CharacterFace {
  family: string
  style: string
  /** Which of the style's files: 0 for its own, then its shards, as `FontManager.shardData` lists them. */
  file: number
  /** Whether it is not the character's own family. */
  fallback: boolean
}

/**
 * The loaded face the paragraph draws the character at `index` of `text` in, as it falls back:
 * of the fonts it lists, the style's own then its fallbacks, each file then its shards, the first
 * that maps the character.
 */
export function characterFace(node: SceneNode, text: string, index: number): CharacterFace | null {
  const codePoint = text.codePointAt(index)
  if (codePoint === undefined) return null
  const character = String.fromCodePoint(codePoint)
  const font = fontAt(node, index)
  for (const family of paragraphSourceFamilies(font.family)) {
    const style = sourceStyle(family, font)
    if (!style) continue
    const fallback = family !== font.family
    if (glyphOutlineSourceSync(family, style, font.variations)?.covers(character))
      return { family, style, file: 0, fallback }
    const shard = fontManager
      .shardData(family, style)
      .findIndex((data) => shardCovers(data, character))
    if (shard !== -1) return { family, style, file: shard + 1, fallback }
  }
  return null
}

/** The family the paragraph draws the character at `index` of `text` in; see {@link characterFace}. */
export function characterFamily(node: SceneNode, text: string, index: number): string | null {
  return characterFace(node, text, index)?.family ?? null
}
