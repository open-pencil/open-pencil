import * as OpenTypeSync from 'opentype.js'

import { getLoadedFontData } from './text/fonts'

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
  getPath(x: number, y: number, fontSize: number): OutlinePath
}

interface OutlineFont {
  unitsPerEm: number
  stringToGlyphs(text: string): OutlineGlyph[]
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

let openTypeModulePromise: Promise<OpenTypeModule> | null = null

async function loadOpenTypeModule() {
  openTypeModulePromise ??= import('opentype.js') as Promise<typeof OpenTypeSync & OpenTypeModule>
  return openTypeModulePromise
}

function commandsToFigmaNumbers(commands: OutlineCommand[]): Array<string | number> {
  const result: Array<string | number> = []
  for (const command of commands) {
    result.push(command.type)
    if (command.x1 !== undefined) result.push(command.x1)
    if (command.y1 !== undefined) result.push(command.y1)
    if (command.x2 !== undefined) result.push(command.x2)
    if (command.y2 !== undefined) result.push(command.y2)
    if (command.x !== undefined) result.push(command.x)
    if (command.y !== undefined) result.push(command.y)
  }
  return result
}

export function getGlyphOutlineCommandsSync(
  family: string,
  style: string,
  text: string,
  fontSize: number
): Array<Array<string | number>> | null {
  const bytes = getLoadedFontData(family, style)
  if (!bytes) return null

  const font = (OpenTypeSync as OpenTypeModule).parse(bytes.slice(0))
  const glyphs = font.stringToGlyphs(text)
  return glyphs.map((glyph) => commandsToFigmaNumbers(glyph.getPath(0, 0, fontSize).commands))
}

export async function probeGlyphOutlineCommands(
  family: string,
  style: string,
  text: string,
  fontSize: number
): Promise<GlyphOutlineProbe | null> {
  const bytes = getLoadedFontData(family, style)
  if (!bytes) return null

  const openType = await loadOpenTypeModule()
  const font = openType.parse(bytes.slice(0))
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
