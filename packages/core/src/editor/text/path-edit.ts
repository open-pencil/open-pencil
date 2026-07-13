import type { SceneNode } from '@open-pencil/scene-graph'

import { encodePathCommandsBlob } from '#core/kiwi/fig/node-change/path-commands'
import { weightToStyle } from '#core/text/fonts'
import { getGlyphOutlineMetricsSync } from '#core/text/opentype'
import {
  calibratePathTextLayout,
  getTextPathData,
  layoutPathTextFromAdvances
} from '#core/text/path-layout'

/**
 * Re-flow imported path text when its characters change: rebuild glyph
 * outlines from the local font and pen-walk them along the preserved path,
 * keeping the calibrated anchor and mean normal offset. Returns {} whenever
 * the node is not reflowable path text or the font is unavailable — the
 * scene graph then falls back to clearing the baked glyphs (today's
 * plain-text editing behavior).
 */
export function pathTextEditChanges(
  node: SceneNode | undefined,
  changes: Partial<SceneNode>
): Partial<Pick<SceneNode, 'figmaDerivedTextGlyphs' | 'strokeGeometry'>> {
  if (node?.type !== 'TEXT') return {}
  if (typeof changes.text !== 'string' || changes.text.trim().length === 0) return {}
  if (!node.textPathBox || !node.figmaDerivedTextGlyphs?.length) return {}
  const data = getTextPathData(node)
  if (!data) return {}

  // Prefer pending typography from the same update batch over the pre-update
  // node so { text, fontSize/fontFamily/... } stays consistent for reflow.
  const fontFamily = changes.fontFamily ?? node.fontFamily
  const fontWeight = changes.fontWeight ?? node.fontWeight
  const italic = changes.italic ?? node.italic
  const fontSize = changes.fontSize ?? node.fontSize
  const letterSpacing = changes.letterSpacing ?? node.letterSpacing

  const metrics = getGlyphOutlineMetricsSync(
    fontFamily,
    weightToStyle(fontWeight, italic),
    changes.text,
    fontSize
  )
  if (!metrics) return {}

  const layout = calibratePathTextLayout(node.figmaDerivedTextGlyphs, data, node.textPathBox)
  if (!layout) return {}
  const offset = layout.offsets.reduce((sum, o) => sum + o, 0) / layout.offsets.length

  const glyphs = layoutPathTextFromAdvances(
    data,
    node.textPathBox,
    layout.anchor,
    offset,
    metrics.map((m) => ({
      commandsBlob: encodePathCommandsBlob(m.commands, fontSize),
      fontSize,
      // Pen walk expects em advances (it multiplies by fontSize); metrics and
      // letterSpacing are px. Folding letterSpacing in here (rather than
      // threading it through layoutPathTextFromAdvances) keeps that function's
      // em-advance contract unchanged for its one caller.
      advance: (m.advance + letterSpacing) / fontSize
    }))
  )
  // Baked silhouettes belong to the OLD string — clear them so the renderer
  // rebuilds per-glyph silhouettes for the new lettering.
  return glyphs ? { figmaDerivedTextGlyphs: glyphs, strokeGeometry: [] } : {}
}
