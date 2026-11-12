import type { ShapedTextGlyph } from '@open-pencil/fig/node-change'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { getCanvasKit } from '#core/canvaskit'
import { renderNodesToSVG, type SVGExportOptions } from '#core/io/formats/svg/export'
import type {
  SVGCharacterEdges,
  SVGFallbackFace,
  SVGTextLayout
} from '#core/io/formats/svg/text/lines'
import { withTextShaper } from '#core/io/shaping'
import { shownText } from '#core/text/case'
import { characterFace } from '#core/text/character-face'
import { EMOJI_METRICS_FAMILY } from '#core/text/emoji'
import { prepareGraphFonts } from '#core/text/prepare'

/**
 * Layers as SVG with their text set as the canvas sets it: the fonts it draws with loaded, each
 * line on the baseline the canvas gives it, and wrapped paragraphs kept wrapped.
 */
export async function renderNodesToLaidOutSVG(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: SVGExportOptions = {}
): Promise<string | null> {
  await prepareGraphFonts(graph, nodeIds)
  return withCanvasTextLayout(async (textLayout) =>
    renderNodesToSVG(graph, pageId, nodeIds, { textLayout, ...options })
  )
}

/**
 * Runs `render` with the line breaks the canvas gives each text node (same paragraph builder and
 * fonts), so a wrapped paragraph stays wrapped. Without CanvasKit, `render` gets no layout and
 * only explicit newlines start a new line.
 */
export async function withCanvasTextLayout<T>(
  render: (textLayout: SVGTextLayout | undefined) => Promise<T>
): Promise<T> {
  const ck = await getCanvasKit().catch(() => null)
  if (!ck) return render(undefined)
  return withTextShaper(ck, (shape) =>
    render((node) => {
      // Shaped lines are cut by character index, which the text's case must keep.
      if (shownText(node).length !== node.text.length) return null
      const shaped = shape(node)
      if (!shaped?.baselines.length) return null
      const characters = characterEdges(shaped.glyphs)
      const fallbacks = fallbackFaces(node, characters)
      return shaped.baselines.map((line) => ({
        start: line.firstCharacter,
        end: line.endCharacter,
        x: line.position.x,
        y: line.position.y,
        width: line.width,
        characters,
        fallbacks
      }))
    })
  )
}

/**
 * The face of each drawn character the canvas draws from another file than its text's own: a
 * fallback font, such as for Chinese in Inter, or a shard of a font split by unicode-range. Emoji
 * keep their own family: the face the canvas lays them out with has no glyphs.
 */
function fallbackFaces(
  node: SceneNode,
  characters: ReadonlyMap<number, SVGCharacterEdges>
): Map<number, SVGFallbackFace> {
  const text = shownText(node)
  const fallbacks = new Map<number, SVGFallbackFace>()
  for (const index of characters.keys()) {
    const face = characterFace(node, text, index)
    if (!face || (!face.fallback && face.file === 0) || face.family === EMOJI_METRICS_FAMILY)
      continue
    fallbacks.set(index, { family: face.family, style: face.style, file: face.file })
  }
  return fallbacks
}

/** The left and right edges of the glyphs each character is drawn with. */
function characterEdges(glyphs: readonly ShapedTextGlyph[]): Map<number, SVGCharacterEdges> {
  const edges = new Map<number, SVGCharacterEdges>()
  for (const glyph of glyphs) {
    if (glyph.firstCharacter === undefined) continue
    const left = glyph.x
    const right = glyph.x + glyph.advance
    const known = edges.get(glyph.firstCharacter)
    edges.set(
      glyph.firstCharacter,
      known
        ? { left: Math.min(known.left, left), right: Math.max(known.right, right) }
        : { left, right }
    )
  }
  return edges
}
