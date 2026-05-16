import * as OpenTypeSync from 'opentype.js'

import { fontManager } from './fonts'

interface OutlineCommand {
  type: string
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

interface OutlinePath {
  commands: OutlineCommand[]
}

interface OutlineGlyph {
  path: OutlinePath
  advanceWidth?: number
  getPath(x: number, y: number, fontSize: number): OutlinePath
}

interface OutlineFont {
  unitsPerEm: number
  ascender: number
  descender: number
  tables: { os2?: { sTypoLineGap?: number } }
  stringToGlyphs(text: string): OutlineGlyph[]
  getAdvanceWidth(text: string, fontSize: number): number
}

export interface GlyphOutlineProbe {
  family: string
  style: string
  unitsPerEm: number
  commandCount: number
  firstGlyphCommandSample: OutlineCommand[]
}

interface OpenTypeModule {
  parse(buffer: ArrayBuffer): OutlineFont
}

const parsedFontCache = new Map<string, OutlineFont>()

function getParsedFont(family: string, style: string): OutlineFont | null {
  const key = `${family}|${style}`
  const cached = parsedFontCache.get(key)
  if (cached) return cached
  const bytes = fontManager.loadedData(family, style)
  if (!bytes) return null
  const font = (OpenTypeSync as OpenTypeModule).parse(bytes.slice(0))
  parsedFontCache.set(key, font)
  return font
}

export function measureTextWithOpenType(
  text: string,
  fontSize: number,
  family: string,
  style: string,
  maxWidth?: number,
  lineHeight?: number
): { width: number; height: number } | null {
  const font = getParsedFont(family, style)
  if (!font) return null

  const scale = fontSize / font.unitsPerEm
  const lineGap = font.tables.os2?.sTypoLineGap ?? 0
  const lineH = lineHeight ?? Math.ceil((font.ascender - font.descender + lineGap) * scale)

  const singleLineWidth = font.getAdvanceWidth(text, fontSize)

  if (maxWidth && maxWidth > 0 && singleLineWidth > maxWidth) {
    const lines = Math.ceil(singleLineWidth / maxWidth)
    return { width: maxWidth, height: Math.ceil(lines * lineH) }
  }
  return { width: Math.ceil(singleLineWidth), height: lineH }
}

export interface GlyphOutlineMetrics {
  commandsBlob: Uint8Array
  x: number
  advance: number
}

const CMD_CLOSE = 0
const CMD_MOVE_TO = 1
const CMD_LINE_TO = 2
const CMD_CUBIC_TO = 4

function commandsToBlob(commands: OutlineCommand[], fontSize: number): Uint8Array {
  const bytes: number[] = []
  const pushFloat = (value: number | undefined) => {
    const buf = new ArrayBuffer(4)
    new DataView(buf).setFloat32(0, (value ?? 0) / fontSize, true)
    bytes.push(...new Uint8Array(buf))
  }

  for (const command of commands) {
    switch (command.type) {
      case 'M':
        bytes.push(CMD_MOVE_TO)
        pushFloat(command.x)
        pushFloat(command.y)
        break
      case 'L':
        bytes.push(CMD_LINE_TO)
        pushFloat(command.x)
        pushFloat(command.y)
        break
      case 'C':
        bytes.push(CMD_CUBIC_TO)
        pushFloat(command.x1)
        pushFloat(command.y1)
        pushFloat(command.x2)
        pushFloat(command.y2)
        pushFloat(command.x)
        pushFloat(command.y)
        break
      case 'Q':
        bytes.push(CMD_LINE_TO)
        pushFloat(command.x)
        pushFloat(command.y)
        break
      case 'Z':
        bytes.push(CMD_CLOSE)
        break
    }
  }

  return new Uint8Array(bytes)
}

export function getGlyphOutlineMetricsSync(
  family: string,
  style: string,
  text: string,
  fontSize: number
): GlyphOutlineMetrics[] | null {
  const font = getParsedFont(family, style)
  if (!font) return null

  const glyphs = font.stringToGlyphs(text)
  let x = 0
  const scale = fontSize / font.unitsPerEm
  return glyphs.map((glyph) => {
    const commandsBlob = commandsToBlob(glyph.getPath(0, 0, fontSize).commands, fontSize)
    const advance = (glyph.advanceWidth ?? 0) * scale
    const metrics = { commandsBlob, x, advance }
    x += advance
    return metrics
  })
}

export async function probeGlyphOutlineCommands(
  family: string,
  style: string,
  text: string,
  fontSize: number
): Promise<GlyphOutlineProbe | null> {
  const bytes = fontManager.loadedData(family, style)
  if (!bytes) return null

  const font = (OpenTypeSync as OpenTypeModule).parse(bytes.slice(0))
  const glyphs = font.stringToGlyphs(text)
  const firstGlyph = glyphs.find((glyph: OutlineGlyph) => glyph.path.commands.length > 0)
  const firstGlyphCommandSample = (firstGlyph?.getPath(0, 0, fontSize).commands ?? []).slice(0, 12)

  return {
    family,
    style,
    unitsPerEm: font.unitsPerEm,
    commandCount: firstGlyph?.path.commands.length ?? 0,
    firstGlyphCommandSample
  }
}
