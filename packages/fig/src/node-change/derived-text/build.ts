import { groupBy } from 'es-toolkit/array'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { normalizeFontFamily, weightToStyle } from '@open-pencil/scene-graph'
import type { DerivedTextGlyph, SceneNode } from '@open-pencil/scene-graph'

import { bytesToHex } from '../bytes'
import { weightToFigmaStyle } from '../font/style'
import { bakeGlyphScale, encodePathCommandsBlob, type OutlineCommand } from '../path/commands'
import { buildDerivedTextData } from './data'

type DerivedTextData = NonNullable<NodeChange['derivedTextData']>
type DerivedTextBaseline = NonNullable<DerivedTextData['baselines']>[number]
type DerivedTextGlyphRecord = NonNullable<DerivedTextData['glyphs']>[number]

/**
 * One shaped glyph in node space: `x`/`y` sit on its baseline, and `commands` are its outline in
 * pixels at `fontSize`, or `null` when the shaper could not tell which font drew it.
 */
export interface ShapedTextGlyph {
  commands: OutlineCommand[] | null
  x: number
  y: number
  fontSize: number
  firstCharacter: number
  /** Horizontal advance in pixels. */
  advance: number
}

/** Text laid out at the node's width, as the renderer draws it. */
export interface ShapedText {
  glyphs: ShapedTextGlyph[]
  baselines: DerivedTextBaseline[]
  /** One entry per UTF-16 character: its x offset from the start of its line. */
  logicalIndexToCharacterOffsetMap: number[]
}

export interface DerivedTextBuildContext {
  digestMap: Map<string, Uint8Array>
  blobs: Uint8Array[]
  glyphBlobMap: Map<string, number>
  shapeText(node: SceneNode): ShapedText | null
}

// Figma stores a whitespace glyph as a lone close command.
const EMPTY_GLYPH_COMMANDS: OutlineCommand[] = [{ type: 'Z' }]

function appendGlyphBlob(context: DerivedTextBuildContext, blob: Uint8Array): number {
  const key = bytesToHex(blob)
  const existing = context.glyphBlobMap.get(key)
  if (existing !== undefined) return existing
  const index = context.blobs.push(blob) - 1
  context.glyphBlobMap.set(key, index)
  return index
}

function fontMetaData(
  node: SceneNode,
  digestMap: Map<string, Uint8Array>
): DerivedTextData['fontMetaData'] {
  const fonts: NonNullable<DerivedTextData['fontMetaData']> = []
  const seen = new Set<string>()
  const addFont = (family: string, weight: number, italic: boolean) => {
    const normalized = normalizeFontFamily(family)
    const key = `${normalized}|${weightToStyle(weight, italic)}`
    if (seen.has(key)) return
    seen.add(key)
    fonts.push({
      key: { family: normalized, style: weightToFigmaStyle(weight, italic), postscript: '' },
      fontLineHeight: 1.2,
      fontDigest: digestMap.get(key),
      fontStyle: italic ? 'ITALIC' : 'NORMAL',
      fontWeight: weight
    })
  }
  addFont(node.fontFamily, node.fontWeight, node.italic)
  for (const run of node.styleRuns) {
    addFont(
      run.style.fontFamily ?? node.fontFamily,
      run.style.fontWeight ?? node.fontWeight,
      run.style.italic ?? node.italic
    )
  }
  return fonts
}

function shapedGlyphRecords(
  shaped: ShapedText,
  context: DerivedTextBuildContext
): DerivedTextGlyphRecord[] {
  return shaped.glyphs.map((glyph) => ({
    commandsBlob: glyph.commands
      ? appendGlyphBlob(
          context,
          encodePathCommandsBlob(
            glyph.commands.length > 0 ? glyph.commands : EMPTY_GLYPH_COMMANDS,
            glyph.fontSize
          )
        )
      : undefined,
    position: { x: glyph.x, y: glyph.y },
    fontSize: glyph.fontSize,
    firstCharacter: glyph.firstCharacter,
    advance: glyph.fontSize > 0 ? glyph.advance / glyph.fontSize : 0,
    rotation: 0
  }))
}

interface SavedGlyph {
  glyph: DerivedTextGlyph
  character: number
}

/**
 * Lines of glyphs the node already has, recovered from their baselines, top to bottom. Path
 * text has no lines, so its glyphs share the one baseline the format requires.
 */
function savedGlyphLines(glyphs: SavedGlyph[]): SavedGlyph[][] {
  if (glyphs.some(({ glyph }) => (glyph.rotation ?? 0) !== 0)) return [glyphs]
  return Object.values(groupBy(glyphs, ({ glyph }) => String(glyph.y))).sort(
    (a, b) => a[0].glyph.y - b[0].glyph.y
  )
}

function savedGlyphLayout(
  node: SceneNode,
  glyphs: DerivedTextGlyph[]
): Pick<ShapedText, 'baselines' | 'logicalIndexToCharacterOffsetMap'> {
  const lineHeight = node.lineHeight ?? Math.ceil(node.fontSize * 1.2)
  const offsets = Array.from({ length: node.text.length }, () => 0)
  const lines = savedGlyphLines(
    glyphs.map((glyph, index) => ({ glyph, character: glyph.firstCharacter ?? index }))
  )
  const baselines = lines.map((line, lineIndex) => {
    const startX = Math.min(...line.map(({ glyph }) => glyph.x))
    for (const { glyph, character } of line) {
      if (character < offsets.length) offsets[character] = glyph.x - startX
    }
    return {
      firstCharacter: line[0].character,
      endCharacter: lines[lineIndex + 1]?.[0].character ?? node.text.length,
      position: { x: startX, y: line[0].glyph.y },
      width: node.width,
      lineY: lineIndex * lineHeight,
      lineHeight,
      lineAscent: Math.max(lineHeight - node.fontSize * 0.2, 0)
    }
  })
  return { baselines, logicalIndexToCharacterOffsetMap: offsets }
}

/**
 * A kept glyph's advance in ems: its own when it has one, else the distance to the next glyph
 * on its line, else nothing.
 */
function savedAdvance(glyph: DerivedTextGlyph, next: DerivedTextGlyph | undefined): number {
  if (glyph.fontSize <= 0) return 0
  if (glyph.advance !== undefined) return (glyph.advance * (glyph.scaleX ?? 1)) / glyph.fontSize
  return next ? Math.max(next.x - glyph.x, 0) / glyph.fontSize : 0
}

function savedGlyphRecords(
  glyphs: DerivedTextGlyph[],
  context: DerivedTextBuildContext
): DerivedTextGlyphRecord[] {
  return glyphs.map((glyph, index) => {
    const next = glyphs[index + 1]
    const sameLine =
      index + 1 < glyphs.length &&
      next.y === glyph.y &&
      (next.rotation ?? 0) === (glyph.rotation ?? 0)
    return {
      commandsBlob: appendGlyphBlob(
        context,
        bakeGlyphScale(
          glyph.commandsBlob,
          glyph.scaleX ?? 1,
          glyph.scaleY ?? 1,
          glyph.rotation ?? 0
        )
      ),
      position: { x: glyph.x, y: glyph.y },
      fontSize: glyph.fontSize,
      firstCharacter: glyph.firstCharacter ?? index,
      advance: savedAdvance(glyph, sameLine ? next : undefined),
      // Preserve path-text radians; hardcoding 0 used to flatten circular text on re-export.
      rotation: glyph.rotation ?? 0
    }
  })
}

/** Glyphs are derived data: a shaper failure must not fail the save or copy that writes them. */
function shapeOrNull(node: SceneNode, context: DerivedTextBuildContext): ShapedText | null {
  try {
    return context.shapeText(node)
  } catch (error) {
    console.warn(`Writing "${node.name}" without glyphs; text shaping failed:`, error)
    return null
  }
}

/**
 * The `derivedTextData` a text node is written with. Glyphs the node already has (from Figma,
 * or placed along a path) are kept; other text is shaped at the node's width. Text that cannot
 * be shaped gets no glyphs, so readers lay it out themselves instead of drawing a guess.
 */
export function buildNodeDerivedTextData(
  node: SceneNode,
  context: DerivedTextBuildContext
): NodeChange['derivedTextData'] {
  const fonts = fontMetaData(node, context.digestMap)
  const saved = node.derivedTextGlyphs ?? []
  if (saved.length > 0) {
    return buildDerivedTextData({
      node,
      glyphs: savedGlyphRecords(saved, context),
      fontMetaData: fonts,
      ...savedGlyphLayout(node, saved)
    })
  }
  const shaped = node.textPathData ? null : shapeOrNull(node, context)
  return buildDerivedTextData({
    node,
    glyphs: shaped ? shapedGlyphRecords(shaped, context) : [],
    fontMetaData: fonts,
    baselines: shaped?.baselines ?? [],
    logicalIndexToCharacterOffsetMap: shaped?.logicalIndexToCharacterOffsetMap ?? []
  })
}
