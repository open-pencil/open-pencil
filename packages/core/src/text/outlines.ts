import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

import type { CharacterStyleOverride, SceneNode } from '@open-pencil/scene-graph'

import { fontManager, weightToStyle } from '#core/text/fonts'
import {
  fontHasGlyphSync,
  getGlyphOutlineMetricsSync,
  type OutlineCommand
} from '#core/text/opentype'

import { CJK_CHAR_RE, fallbackScriptsForCharacter } from './coverage'
import { cjkFallbackFamiliesForScripts } from './fallback-order'

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
    'fontFamily' | 'fontSize' | 'fontWeight' | 'italic' | 'letterSpacing'
  >
>

function baseTextStyle(node: SceneNode): TextStyle {
  return {
    fontFamily: node.fontFamily,
    fontSize: node.fontSize,
    fontWeight: node.fontWeight,
    italic: node.italic,
    letterSpacing: node.letterSpacing
  }
}

function styleName(style: Pick<TextStyle, 'fontWeight' | 'italic'>): string {
  return weightToStyle(style.fontWeight, style.italic)
}

function styleKey(style: TextStyle): string {
  return `${style.fontFamily}|${styleName(style)}|${style.fontSize}|${style.letterSpacing}`
}

function textStyleAt(node: SceneNode, index: number): TextStyle {
  const base = baseTextStyle(node)
  const run = node.styleRuns.find((item) => index >= item.start && index < item.start + item.length)
  if (!run) return base
  return {
    fontFamily: run.style.fontFamily ?? base.fontFamily,
    fontSize: run.style.fontSize ?? base.fontSize,
    fontWeight: run.style.fontWeight ?? base.fontWeight,
    italic: run.style.italic ?? base.italic,
    letterSpacing: run.style.letterSpacing ?? base.letterSpacing
  }
}

function resolvedGlyphStyle(style: TextStyle, char: string): TextStyle | null {
  if (fontHasGlyphSync(style.fontFamily, styleName(style), char)) return style
  const family = fallbackFamilies(char).find((candidate) => {
    const next = fallbackStyle(style, candidate)
    return (
      fontManager.loadedData(next.fontFamily, styleName(next)) &&
      fontHasGlyphSync(next.fontFamily, styleName(next), char)
    )
  })
  return family ? fallbackStyle(style, family) : null
}

function fallbackFamilies(char: string): string[] {
  const scripts = fallbackScriptsForCharacter(char)
  if (scripts.length === 0) {
    return [...fontManager.getCJKFallbackFamilies(), ...fontManager.getArabicFallbackFamilies()]
  }

  const families: string[] = []
  if (scripts.some((script) => script !== 'arabic')) {
    families.push(...cjkFallbackFamiliesForScripts(fontManager, scripts))
  }
  if (scripts.includes('arabic')) families.push(...fontManager.getArabicFallbackFamilies())
  return families
}

function fallbackStyle(style: TextStyle, family: string): TextStyle {
  return { ...style, fontFamily: family }
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
    if (!fontManager.loadedData(style.fontFamily, styleName(style))) {
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
  return node.lineHeight ?? Math.ceil(node.fontSize * 1.2)
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

function glyphAdvance(node: SceneNode, absoluteIndex: number): number | null {
  const char = node.text[absoluteIndex]
  const style = resolvedGlyphStyle(textStyleAt(node, absoluteIndex), char)
  if (!style) return null
  const metrics = getGlyphOutlineMetricsSync(
    style.fontFamily,
    styleName(style),
    char,
    style.fontSize
  )
  const glyph = metrics?.[0]
  return glyph ? glyph.advance + style.letterSpacing : null
}

function wrapStyledLine(node: SceneNode, line: TextLine): TextLine[] {
  if (!line.text || node.width <= 0) return [line]
  const result: TextLine[] = []
  let lineStart = 0
  let cursor = 0
  let lastBreak = -1

  for (let index = 0; index < line.text.length; index++) {
    const advance = glyphAdvance(node, line.start + index)
    if (advance == null) return [line]
    cursor += advance
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
  if (node.styleRuns.length > 0 || hardLines.some((line) => CJK_CHAR_RE.test(line.text))) {
    return hardLines.flatMap((line) => wrapStyledLine(node, line))
  }

  const result: TextLine[] = []
  for (const hardLine of hardLines) {
    if (!hardLine.text) {
      result.push(hardLine)
      continue
    }
    try {
      const prepared = prepareWithSegments(hardLine.text, `${node.fontSize}px ${node.fontFamily}`)
      const layout = layoutWithLines(prepared, node.width, lineHeight(node))
      let start = hardLine.start
      for (const line of layout.lines) {
        result.push({ text: line.text, start })
        start += line.text.length
      }
    } catch {
      result.push(hardLine)
    }
  }
  return result
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
  const glyphs: TextOutlineGlyph[] = []
  let cursorX = xOffset
  let index = 0

  while (index < line.text.length) {
    const absoluteIndex = line.start + index
    const style = resolvedGlyphStyle(textStyleAt(node, absoluteIndex), line.text[index])
    if (!style) return null
    const key = styleKey(style)
    let end = index + 1
    while (end < line.text.length) {
      const nextStyle = resolvedGlyphStyle(textStyleAt(node, line.start + end), line.text[end])
      if (!nextStyle || styleKey(nextStyle) !== key) break
      end++
    }

    const segment = line.text.slice(index, end)
    const metrics = getGlyphOutlineMetricsSync(
      style.fontFamily,
      styleName(style),
      segment,
      style.fontSize
    )
    if (!metrics) return null

    for (const glyph of metrics) {
      glyphs.push({ commands: glyph.commands, x: cursorX, y: baseline })
      cursorX += glyph.advance + style.letterSpacing
    }
    index = end
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
