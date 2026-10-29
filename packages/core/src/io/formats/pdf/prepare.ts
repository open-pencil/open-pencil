import { uniq } from 'es-toolkit'

import type { ShapedTextGlyph } from '@open-pencil/fig/node-change'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { characterFace } from '#core/canvas/text/placed'
import { withTextShaper } from '#core/canvas/text/shape'
import { getCanvasKit } from '#core/canvaskit'
import { populateFigPage } from '#core/io/formats/fig'
import type { SVGCharacterEdges, SVGFallbackFace, SVGTextLayout } from '#core/io/formats/svg'
import { computeAllLayouts } from '#core/layout'
import { shownText } from '#core/text/case'
import { EMOJI_METRICS_FAMILY } from '#core/text/emoji'
import { ARABIC_CHARACTER } from '#core/text/fallbacks'
import type { DocumentFontStatus } from '#core/text/font/status'
import { fontManager } from '#core/text/fonts'
import { prepareGraphFonts } from '#core/text/prepare'
import { collectGraphFontRequirements } from '#core/text/requirements'

import type { PDFFontFace } from './fonts'
import type { PDFPageSpec } from './plan'

/**
 * Loads every font the text of these pages draws with, as the canvas does: the faces, the
 * characters remote fonts must cover, and the script and emoji fallbacks. Fonts loaded for some
 * characters only cover the ones jsPDF writes too.
 */
export async function preparePDFFonts(
  graph: SceneGraph,
  specs: readonly PDFPageSpec[]
): Promise<DocumentFontStatus> {
  const nodeIds = specs.flatMap((spec) => spec.nodeIds)
  return prepareGraphFonts(graph, nodeIds, await pdfWrittenCharacters(graph, nodeIds))
}

/**
 * Characters jsPDF writes for the text besides its own: it writes Arabic letters as their
 * presentation forms, picked by the letters around them, so the embedded fonts must map those.
 */
async function pdfWrittenCharacters(
  graph: SceneGraph,
  nodeIds: readonly string[]
): Promise<string> {
  const texts = collectGraphFontRequirements(graph, nodeIds)
    .nodes.filter((node) => node.type === 'TEXT')
    .map(shownText)
    .filter((text) => ARABIC_CHARACTER.test(text))
  if (texts.length === 0) return ''
  const { jsPDF } = await import('jspdf')
  // jsPDF adds its Arabic parser to each document it makes, as the one it writes the text with.
  const writer = new jsPDF()
  return uniq(texts.flatMap((text) => Array.from(writer.processArabic(text)))).join('')
}

/**
 * Design pages other than the open one may still be unread, since `.fig` pages load on demand.
 * Reads the pages a `pages` export asks for, or every page, so planning sees their layers.
 */
export function readPDFPages(graph: SceneGraph, pageIds?: readonly string[]): void {
  // No ids, or an empty list, exports every page, as planPDFPages reads them.
  const ids = pageIds?.length ? pageIds : graph.getPages().map((page) => page.id)
  for (const pageId of ids) {
    populateFigPage(graph, pageId)
  }
}

/**
 * Loads the fonts the text of pages read by {@link readPDFPages} needs and lays them out, since
 * pages other than the open one have no layout yet, so every PDF page is complete.
 */
export async function preparePagesForPDF(
  graph: SceneGraph,
  specs: readonly PDFPageSpec[]
): Promise<DocumentFontStatus> {
  const status = await preparePDFFonts(graph, specs)
  graph.applyDerivedLayoutDuring(() => {
    for (const spec of specs) computeAllLayouts(graph, spec.pageId)
  })
  return status
}

/** The faces the pages' text uses, with the files the canvas draws them from. */
export function pdfFontFaces(status: DocumentFontStatus): PDFFontFace[] {
  return status.faces.map((face) => {
    const data =
      face.status === 'available' ? fontManager.loadedData(face.family, face.style) : null
    if (data) return { family: face.family, style: face.style, data }
    const missing =
      face.reason === 'unsupported-format' ? 'unsupported font format' : 'font file not available'
    return { family: face.family, style: face.style, data, missing }
  })
}

/**
 * Runs `render` with the line breaks the canvas gives each text node (same paragraph builder and
 * fonts), so a wrapped paragraph stays wrapped in the PDF. Without CanvasKit, `render` gets no
 * layout and only explicit newlines start a new line.
 */
export async function withPDFTextLayout<T>(
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
 * keep their own family: the face the canvas lays them out with has no glyphs to embed.
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
