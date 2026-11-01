import type { CharacterStyleOverride, FontVariation, SceneNode } from '@open-pencil/scene-graph'
import { faceStyleKey } from '@open-pencil/scene-graph/font-style'
import { rangeFontStyle } from '@open-pencil/scene-graph/shared-styles'
import { lineHeightPixels, textLengthPixels } from '@open-pencil/scene-graph/text'

import { drawnFontVariations } from '#core/canvas/text/font-families'
import {
  fontHasGlyphSync,
  getGlyphOutlineMetricsSync,
  shapedAdvancesSync,
  type OutlineCommand
} from '#core/text/font/glyphs'
import { fontManager } from '#core/text/font/manager'

export type TextOutlineUnsupportedReason =
  | 'not-text'
  | 'empty-text'
  | 'missing-font'
  | 'missing-glyph'
  | 'complex-script'

export type TextOutlineSupport =
  | { supported: true }
  | { supported: false; reason: TextOutlineUnsupportedReason }

export interface TextOutlineGlyph {
  commands: OutlineCommand[]
  x: number
  y: number
}

export interface TextOutlineLayout {
  glyphs: TextOutlineGlyph[]
  width: number
  height: number
}

const COMPLEX_SCRIPT_PATTERN = /[\u0590-\u08ff\u0900-\u0dff\ufb1d-\ufdff\ufe70-\ufeff]/

type TextStyle = Required<
  Pick<
    CharacterStyleOverride,
    'fontFamily' | 'fontSize' | 'fontWeight' | 'italic' | 'fontStyle' | 'letterSpacing'
  >
> & {
  /** The axes a variable font draws the text at; a script fallback draws at the text font's. */
  variations: FontVariation[]
}

function withVariations(
  style: Omit<TextStyle, 'variations'>,
  variations: FontVariation[],
  opticalSizeFromFontSize: boolean
): TextStyle {
  return {
    ...style,
    variations: drawnFontVariations({
      family: style.fontFamily,
      weight: style.fontWeight,
      italic: style.italic,
      style: faceStyleKey(style),
      fontSize: style.fontSize,
      variations,
      opticalSizeFromFontSize
    })
  }
}

function baseTextStyle(node: SceneNode): TextStyle {
  return withVariations(
    {
      fontFamily: node.fontFamily,
      fontSize: node.fontSize,
      fontWeight: node.fontWeight,
      italic: node.italic,
      fontStyle: node.fontStyle,
      letterSpacing: node.letterSpacing
    },
    node.fontVariations,
    node.opticalSizeFromFontSize
  )
}

function styleKey(style: TextStyle): string {
  const spacing = textLengthPixels(style.letterSpacing, style.fontSize)
  const axes = style.variations.map(({ axis, value }) => `${axis}=${value}`).join(',')
  return `${style.fontFamily}|${faceStyleKey(style)}|${style.fontSize}|${spacing}|${axes}`
}

function textStyleAt(node: SceneNode, index: number): TextStyle {
  const run = node.styleRuns.find((item) => index >= item.start && index < item.start + item.length)
  if (!run) return baseTextStyle(node)
  return withVariations(
    {
      fontFamily: run.style.fontFamily ?? node.fontFamily,
      fontSize: run.style.fontSize ?? node.fontSize,
      fontWeight: run.style.fontWeight ?? node.fontWeight,
      italic: run.style.italic ?? node.italic,
      fontStyle: rangeFontStyle(node, run.style),
      letterSpacing: run.style.letterSpacing ?? node.letterSpacing
    },
    run.style.fontVariations ?? node.fontVariations,
    run.style.opticalSizeFromFontSize ?? node.opticalSizeFromFontSize
  )
}

function resolvedGlyphStyle(style: TextStyle, char: string): TextStyle | null {
  if (fontHasGlyphSync(style.fontFamily, faceStyleKey(style), char)) return style
  const family = fallbackFamilies().find((candidate) => {
    const next = fallbackStyle(style, candidate)
    return (
      fontManager.loadedData(next.fontFamily, faceStyleKey(next)) &&
      fontHasGlyphSync(next.fontFamily, faceStyleKey(next), char)
    )
  })
  return family ? fallbackStyle(style, family) : null
}

function fallbackFamilies(): string[] {
  return [...fontManager.getCJKFallbackFamilies(), ...fontManager.getArabicFallbackFamilies()]
}

/** `style` in a script fallback family, which has none of the text family's named faces. */
function fallbackStyle(style: TextStyle, family: string): TextStyle {
  return { ...style, fontFamily: family, fontStyle: null }
}

function textStyles(node: SceneNode): TextStyle[] {
  if (node.styleRuns.length === 0) return [baseTextStyle(node)]
  const styles = new Map<string, TextStyle>()
  for (let index = 0; index < node.text.length; index++) {
    const style = textStyleAt(node, index)
    styles.set(styleKey(style), style)
  }
  return [...styles.values()]
}

export function getTextOutlineSupport(node: SceneNode): TextOutlineSupport {
  if (node.type !== 'TEXT') return { supported: false, reason: 'not-text' }
  if (!node.text) return { supported: false, reason: 'empty-text' }
  if (COMPLEX_SCRIPT_PATTERN.test(node.text)) return { supported: false, reason: 'complex-script' }
  for (const style of textStyles(node)) {
    if (!fontManager.loadedData(style.fontFamily, faceStyleKey(style))) {
      return { supported: false, reason: 'missing-font' }
    }
  }
  for (let index = 0; index < node.text.length; index++) {
    const char = node.text[index]
    if (char === '\n') continue
    const style = textStyleAt(node, index)
    if (!resolvedGlyphStyle(style, char)) return { supported: false, reason: 'missing-glyph' }
  }
  return { supported: true }
}

function lineHeight(node: SceneNode): number {
  return lineHeightPixels(node.lineHeight, node.fontSize) ?? Math.ceil(node.fontSize * 1.2)
}

interface TextLine {
  text: string
  start: number
}

function hardTextLines(text: string): TextLine[] {
  const lines: TextLine[] = []
  let start = 0
  for (const line of text.split('\n')) {
    lines.push({ text: line, start })
    start += line.length + 1
  }
  return lines
}

interface StyleSegment {
  start: number
  end: number
  style: TextStyle
}

/** `line` split where the style its characters are drawn in changes, or `null` when one has none. */
function styleSegments(node: SceneNode, line: TextLine): StyleSegment[] | null {
  const segments: StyleSegment[] = []
  for (let index = 0; index < line.text.length; index++) {
    const style = resolvedGlyphStyle(textStyleAt(node, line.start + index), line.text[index])
    if (!style) return null
    const last = segments.at(-1)
    if (last && styleKey(last.style) === styleKey(style)) last.end = index + 1
    else segments.push({ start: index, end: index + 1, style })
  }
  return segments
}

/**
 * The width each character of `line` adds as its segments are shaped and drawn, kerning and
 * ligatures included: a glyph's advance and spacing go to the character it starts at.
 */
function characterAdvances(node: SceneNode, line: TextLine): number[] | null {
  const segments = styleSegments(node, line)
  if (!segments) return null
  const advances = Array.from<number>({ length: line.text.length }).fill(0)
  for (const { start, end, style } of segments) {
    const glyphs = shapedAdvancesSync(
      style.fontFamily,
      faceStyleKey(style),
      line.text.slice(start, end),
      style.fontSize,
      style.variations
    )
    if (!glyphs) return null
    const spacing = textLengthPixels(style.letterSpacing, style.fontSize)
    for (const glyph of glyphs) advances[start + glyph.cluster] += glyph.advance + spacing
  }
  return advances
}

function wrapLine(node: SceneNode, line: TextLine): TextLine[] {
  if (!line.text || node.width <= 0) return [line]
  const advances = characterAdvances(node, line)
  if (!advances) return [line]
  const result: TextLine[] = []
  let lineStart = 0
  let cursor = 0
  let lastBreak = -1

  for (let index = 0; index < line.text.length; index++) {
    cursor += advances[index]
    if (/\s/.test(line.text[index])) {
      lastBreak = index + 1
    }
    if (cursor <= node.width || index === lineStart) continue

    const breakIndex = lastBreak > lineStart ? lastBreak : index
    result.push({ text: line.text.slice(lineStart, breakIndex), start: line.start + lineStart })
    lineStart = breakIndex
    index = breakIndex - 1
    cursor = 0
    lastBreak = -1
  }

  result.push({ text: line.text.slice(lineStart), start: line.start + lineStart })
  return result
}

function textLines(node: SceneNode): TextLine[] {
  const hardLines = hardTextLines(node.text)
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') return hardLines
  return hardLines.flatMap((line) => wrapLine(node, line))
}

function lineOffsetX(node: SceneNode, width: number): number {
  switch (node.textAlignHorizontal) {
    case 'CENTER':
      return Math.max(0, (node.width - width) / 2)
    case 'RIGHT':
      return Math.max(0, node.width - width)
    default:
      return 0
  }
}

function verticalOffset(node: SceneNode, contentHeight: number): number {
  switch (node.textAlignVertical) {
    case 'CENTER':
      return Math.max(0, (node.height - contentHeight) / 2)
    case 'BOTTOM':
      return Math.max(0, node.height - contentHeight)
    default:
      return 0
  }
}

function lineGlyphs(
  node: SceneNode,
  line: TextLine,
  baseline: number,
  xOffset: number
): { glyphs: TextOutlineGlyph[]; width: number } | null {
  const segments = styleSegments(node, line)
  if (!segments) return null
  const glyphs: TextOutlineGlyph[] = []
  let cursorX = xOffset

  for (const { start, end, style } of segments) {
    const metrics = getGlyphOutlineMetricsSync(
      style.fontFamily,
      faceStyleKey(style),
      line.text.slice(start, end),
      style.fontSize,
      style.variations
    )
    if (!metrics) return null

    for (const glyph of metrics) {
      glyphs.push({ commands: glyph.commands, x: cursorX, y: baseline })
      cursorX += glyph.advance + textLengthPixels(style.letterSpacing, style.fontSize)
    }
  }

  return { glyphs, width: cursorX - xOffset }
}

export function textNodeToOutlineLayout(node: SceneNode): TextOutlineLayout | null {
  if (!getTextOutlineSupport(node).supported) return null

  const lines = textLines(node)
  const lineH = lineHeight(node)
  const contentHeight = lines.length * lineH
  const yOffset = verticalOffset(node, contentHeight)
  const glyphs: TextOutlineGlyph[] = []
  let maxWidth = 0

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const baseline = yOffset + lineIndex * lineH + lineH
    const measured = lineGlyphs(node, lines[lineIndex], baseline, 0)
    if (!measured) return null
    const xOffset = lineOffsetX(node, measured.width)
    maxWidth = Math.max(maxWidth, measured.width)
    const placed =
      xOffset === 0
        ? measured.glyphs
        : measured.glyphs.map((glyph) => ({ ...glyph, x: glyph.x + xOffset }))
    glyphs.push(...placed)
  }

  return { glyphs, width: maxWidth, height: contentHeight }
}
