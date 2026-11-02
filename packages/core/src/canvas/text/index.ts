import type { SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY } from '#core/constants'
import { shownCharacters, shownText } from '#core/text/case'
import { fontManager } from '#core/text/font/manager'
import { textFontFace } from '#core/text/requirements/collect'
import {
  fontCoverageDemand,
  fontFaceDemand,
  fontRemoteCoverageDemand,
  fontResolver,
  missingGlyphOccurrences,
  missingGlyphsByScript
} from '#core/text/resolver'

import { drawTextLayout } from './decorations'
import { buildParagraph } from './layout/build'
import { resolveParagraphLayoutWidth } from './paragraph'
import { withPreparedText } from './preparation'
import type { FontReadinessRenderer, TextRenderer } from './renderer'

export { buildParagraph } from './layout/build'
export type { TextLayout } from './layout'
export type { ParagraphBuildOptions } from './paint'
export { textFontFeatures, textFontVariations, textHeightBehaviorValue } from './paragraph'
export { withTextParagraph } from './preparation'

function demandFace(
  r: FontReadinessRenderer,
  node: SceneNode,
  family: string,
  style: string
): boolean {
  if (fontManager.isStyleLoaded(family, style)) return true
  const demand = fontFaceDemand(family, style, node.text)
  r.trackFontDemand?.(node, demand.key)
  void fontResolver.demandForNode(demand, node.id, r.onFontResolutionSettled)
  return false
}

function requiredNodeFaces(node: SceneNode): Array<{ family: string; style: string }> {
  const baseFamily = node.fontFamily || DEFAULT_FONT_FAMILY
  const faces = new Map<string, { family: string; style: string }>()
  const add = (family: string, style: string) => faces.set(`${family}\0${style}`, { family, style })
  add(baseFamily, textFontFace(node).style)
  for (const run of node.styleRuns) {
    add(run.style.fontFamily ?? baseFamily, textFontFace(node, run.style).style)
  }
  return Array.from(faces.values())
}

function languageForCharacter(node: SceneNode, sourceIndex: number): string | null {
  const run = node.styleRuns.find(
    (item) => sourceIndex >= item.start && sourceIndex < item.start + item.length
  )
  return run?.style.textLanguage !== undefined ? run.style.textLanguage : node.textLanguage
}

function transformedSourceOffsets(node: SceneNode): number[] {
  return shownCharacters(node).map((shown) => shown.sourceIndex)
}

export type NodeFontReadiness = 'ready' | 'substituted' | 'pending' | 'exhausted'

function requiredFacesReadiness(r: FontReadinessRenderer, node: SceneNode): NodeFontReadiness {
  let pending = false
  let exhausted = false
  for (const { family, style } of requiredNodeFaces(node)) {
    if (fontManager.isStyleLoaded(family, style)) continue
    const demand = fontFaceDemand(family, style, node.text)
    const state = fontResolver.state(demand).state
    demandFace(r, node, family, style)
    if (state === 'failed' || state === 'exhausted') {
      // A missing face is drawn in another loaded face of the family, as Figma draws it, and
      // reported missing; the text stays visible when an exact face (Italic) is unavailable.
      if (fontManager.isLoaded(family)) continue
      exhausted = true
    } else {
      pending = true
    }
  }
  if (pending) return 'pending'
  if (exhausted && fontManager.isStyleLoaded(DEFAULT_FONT_FAMILY, 'Regular')) return 'substituted'
  return exhausted ? 'exhausted' : 'ready'
}

function demandRemoteCoverage(r: TextRenderer, node: SceneNode, characters: string[]): boolean {
  for (const { family, style } of requiredNodeFaces(node)) {
    if (!fontManager.remoteStyleNeedsCoverage(family, style, characters)) continue
    const demand = fontRemoteCoverageDemand(family, style, characters)
    const state = fontResolver.state(demand).state
    if (state === 'idle') {
      r.trackFontDemand?.(node, demand.key)
      void fontResolver.demandForNode(demand, node.id, r.onFontResolutionSettled)
      return true
    }
    if (state === 'loading') return true
    if (state === 'loaded') fontResolver.exhaust(demand)
  }
  return false
}

function observedGlyphReadiness(r: TextRenderer, node: SceneNode): NodeFontReadiness {
  if (
    r.fontProvider &&
    r.textPreparationCache?.hasGlyphCoverage(node, fontManager.generation(), r.fontProvider)
  )
    return 'ready'

  const missingOccurrences = withPreparedText(
    r,
    node,
    'coverage',
    () => buildParagraph(r, node),
    (prepared) => {
      if (!prepared.missingGlyphs) {
        prepared.paragraph.layout(resolveParagraphLayoutWidth(node))
        prepared.missingGlyphs = missingGlyphOccurrences(
          shownText(node),
          prepared.paragraph.getShapedLines(),
          transformedSourceOffsets(node)
        )
      }
      return prepared.missingGlyphs
    }
  )
  if (missingOccurrences.length === 0) {
    r.textPreparationCache?.recordGlyphCoverage(node)
    return 'ready'
  }

  const charactersByScript = missingGlyphsByScript(missingOccurrences, (offset) =>
    languageForCharacter(node, offset)
  )

  let pending = false
  let exhausted = charactersByScript.size === 0
  for (const [script, characters] of charactersByScript) {
    if (demandRemoteCoverage(r, node, characters)) {
      pending = true
      continue
    }

    const demand = fontCoverageDemand(script, characters)
    const state = fontResolver.state(demand).state
    if (state === 'loaded') {
      fontResolver.exhaust(demand)
      exhausted = true
      continue
    }
    if (state === 'exhausted' || state === 'failed') {
      exhausted = true
      continue
    }
    pending = true
    if (state === 'idle') {
      r.trackFontDemand?.(node, demand.key)
      void fontResolver.demandForNode(demand, node.id, r.onFontResolutionSettled)
    }
  }
  if (pending) return 'pending'
  // Once no fallback is left for a character, the text draws with the fonts it has, the font's
  // missing-glyph box standing in for that character, rather than not at all.
  return exhausted ? 'substituted' : 'ready'
}

function canObserveGlyphCoverage(r: FontReadinessRenderer): r is TextRenderer {
  return r.ck !== undefined && r.fontProvider != null && r.fontsLoaded !== undefined
}

export function nodeFontReadiness(r: FontReadinessRenderer, node: SceneNode): NodeFontReadiness {
  if (node.type !== 'TEXT') return 'ready'
  const faces = requiredFacesReadiness(r, node)
  if (faces === 'pending' || faces === 'exhausted') return faces
  if (!node.text || !canObserveGlyphCoverage(r)) return faces
  const glyphs = observedGlyphReadiness(r, node)
  // Substituted text still needs script fallbacks (for example CJK) for glyphs the substitute
  // lacks, but stays visible when none can be found.
  if (faces === 'substituted') return glyphs === 'pending' ? 'pending' : 'substituted'
  return glyphs
}

export function isNodeFontLoaded(r: FontReadinessRenderer, node: SceneNode): boolean {
  const readiness = nodeFontReadiness(r, node)
  return readiness === 'ready' || readiness === 'substituted'
}

export function measureTextNode(
  r: TextRenderer,
  node: SceneNode,
  maxWidth?: number
): { width: number; height: number } | null {
  if (!r.fontsLoaded || !r.fontProvider || !isNodeFontLoaded(r, node)) return null
  if (node.type !== 'TEXT' || !node.text) return null

  const layoutWidth = resolveParagraphLayoutWidth(node, maxWidth)
  const measure = () => {
    const paragraph = buildParagraph(r, node)
    paragraph.layout(layoutWidth)
    const width = paragraph.getLongestLine()
    const height = paragraph.getHeight()
    paragraph.delete()
    return { width: Math.ceil(width), height: Math.ceil(height) }
  }
  // Layout asks for the same text at the same width many times per pass.
  return r.textPreparationCache
    ? r.textPreparationCache.measure(
        node,
        layoutWidth,
        fontManager.generation(),
        r.fontProvider,
        measure
      )
    : measure()
}

export function buildTextPicture(r: TextRenderer, node: SceneNode): Uint8Array | null {
  if (!r.fontsLoaded || !r.fontProvider || !isNodeFontLoaded(r, node)) return null
  if (node.type !== 'TEXT' || !node.text) return null

  const ck = r.ck
  const recorder = new ck.PictureRecorder()
  const bounds = ck.LTRBRect(0, 0, node.width || 1e6, node.height || 1e6)
  const recCanvas = recorder.beginRecording(bounds)

  const layout = buildParagraph(r, node)
  const paint = new ck.Paint()
  try {
    drawTextLayout(ck, recCanvas, node, { paragraph: layout }, 0, paint)
  } finally {
    paint.delete()
    layout.delete()
  }

  const picture = recorder.finishRecordingAsPicture()
  recorder.delete()

  const bytes = picture.serialize()
  picture.delete()
  return bytes ?? null
}

/** Offset that places laid-out text of `contentHeight` in the node box by vertical alignment. */
export function textVerticalOffset(node: SceneNode, contentHeight: number): number {
  const available = Math.max(0, node.height - contentHeight)
  if (node.textAlignVertical === 'CENTER') return available / 2
  if (node.textAlignVertical === 'BOTTOM') return available
  return 0
}
