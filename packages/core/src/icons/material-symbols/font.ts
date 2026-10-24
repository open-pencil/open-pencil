import * as OpenType from 'opentype.js'

import type { IconOptions } from '@open-pencil/scene-graph/icons'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

import type { IconOption, IconPath } from '#core/icons/types'
import { sfntFont } from '#core/text/font/woff2'

/** Material Symbols' sets, each one of Google's three fonts. */
export const MATERIAL_SYMBOLS_PREFIXES = [
  'material-symbols-outlined',
  'material-symbols-rounded',
  'material-symbols-sharp'
] as const

export type MaterialSymbolsPrefix = (typeof MATERIAL_SYMBOLS_PREFIXES)[number]

/** The font each set is drawn from. */
export const MATERIAL_SYMBOLS_SETS: Readonly<Record<MaterialSymbolsPrefix, string>> = {
  'material-symbols-outlined': 'Material Symbols Outlined',
  'material-symbols-rounded': 'Material Symbols Rounded',
  'material-symbols-sharp': 'Material Symbols Sharp'
}

export function isMaterialSymbolsPrefix(prefix: string): prefix is MaterialSymbolsPrefix {
  return MATERIAL_SYMBOLS_PREFIXES.some((known) => known === prefix)
}

/** The axes Google serves Material Symbols with, as the icon's options, in its request order. */
export const MATERIAL_SYMBOLS_OPTIONS = [
  { key: 'opsz', name: 'Optical size', min: 20, max: 48, default: 24, step: 1 },
  { key: 'wght', name: 'Weight', min: 100, max: 700, default: 400, step: 1 },
  { key: 'FILL', name: 'Fill', min: 0, max: 1, default: 0, step: 1 },
  { key: 'GRAD', name: 'Grade', min: -50, max: 200, default: 0, step: 1 }
] as const satisfies readonly IconOption[]

/** A command of a glyph's outline, as opentype.js gives it. */
interface PathCommand {
  type: string
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

interface LigatureSubtable {
  coverage?: { glyphs?: number[]; ranges?: { start: number; end: number; index: number }[] }
  ligatureSets?: { ligGlyph: number; components: number[] }[][]
  extension?: LigatureSubtable
}

/** What drawing Material Symbols reads of a font parsed by opentype.js, which ships no types. */
export interface MaterialSymbolsFont {
  charToGlyphIndex(character: string): number
  glyphs: {
    get(index: number): {
      getPath(
        x: number,
        y: number,
        fontSize: number,
        options: { variation: Record<string, number> },
        font: MaterialSymbolsFont
      ): { commands: PathCommand[] }
    }
  }
  tables: { gsub?: { lookups: { subtables: LigatureSubtable[] }[] } }
}

interface OpenTypeModule {
  parse(buffer: ArrayBuffer): MaterialSymbolsFont
}

const CSS_API = 'https://fonts.googleapis.com/css2'
/** Google serves variable fonts as WOFF2, and only to clients that say they read it. */
const WOFF2_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

/** Every option set, each clamped to its axis and defaulted where `options` leaves it out. */
export function materialSymbolsOptions(options: IconOptions = {}): Record<string, number> {
  return Object.fromEntries(
    MATERIAL_SYMBOLS_OPTIONS.map(({ key, min, max, default: fallback }) => {
      const value = options[key]
      return [key, typeof value === 'number' ? Math.min(max, Math.max(min, value)) : fallback]
    })
  )
}

/** A Material Symbols font holding just `names`, every axis variable, as Google cuts it. */
export async function fetchMaterialSymbolsFont(
  fetcher: typeof globalThis.fetch,
  prefix: MaterialSymbolsPrefix,
  names: readonly string[]
): Promise<MaterialSymbolsFont> {
  const axes = MATERIAL_SYMBOLS_OPTIONS.map((option) => option.key).join(',')
  const ranges = MATERIAL_SYMBOLS_OPTIONS.map((option) => `${option.min}..${option.max}`).join(',')
  const query = new URLSearchParams({
    family: `${MATERIAL_SYMBOLS_SETS[prefix]}:${axes}@${ranges}`,
    // Google wants the names sorted.
    icon_names: [...names].sort().join(',')
  })
  const css = await fetcher(`${CSS_API}?${query}`, { headers: { 'user-agent': WOFF2_USER_AGENT } })
  if (!css.ok) throw new Error(`Google Fonts answered ${css.status} for ${prefix}`)
  const url = /src:\s*url\((https:[^)]+)\)/.exec(await css.text())?.[1]
  if (!url) throw new Error(`Google Fonts served no font for ${prefix}`)
  const file = await fetcher(url)
  if (!file.ok) throw new Error(`Google Fonts answered ${file.status} for ${url}`)
  return (OpenType as OpenTypeModule).parse(await sfntFont(await file.arrayBuffer()))
}

/** Where `glyph` stands in a coverage table, or -1 when the table does not cover it. */
function coverageIndex(coverage: LigatureSubtable['coverage'], glyph: number): number {
  const listed = coverage?.glyphs?.indexOf(glyph) ?? -1
  if (listed !== -1) return listed
  const range = coverage?.ranges?.find((item) => glyph >= item.start && glyph <= item.end)
  return range ? range.index + glyph - range.start : -1
}

/**
 * The glyph a Material Symbols name draws: the ligature its letters form. The fonts keep their
 * ligatures in an extension lookup, which opentype.js parses but does not apply, so the lookup is
 * read here.
 */
export function materialSymbolsGlyph(font: MaterialSymbolsFont, name: string): number | null {
  const letters = Array.from(name, (character) => font.charToGlyphIndex(character))
  const [first, ...rest] = letters
  for (const lookup of font.tables.gsub?.lookups ?? []) {
    for (const table of lookup.subtables) {
      const subtable = table.extension ?? table
      const set = subtable.ligatureSets?.[coverageIndex(subtable.coverage, first)]
      const ligature = set?.find(
        (item) =>
          item.components.length === rest.length &&
          item.components.every((component, index) => component === rest[index])
      )
      if (ligature) return ligature.ligGlyph
    }
  }
  return null
}

/**
 * A glyph's outline as SVG path data in a `size` square: the font's em square, whose top is one
 * em above the baseline, with the glyph at `axes`.
 */
export function materialSymbolsPathData(
  font: MaterialSymbolsFont,
  glyph: number,
  size: number,
  axes: Record<string, number>
): string {
  const path = font.glyphs.get(glyph).getPath(0, size, size, { variation: axes }, font)
  return closedPathData(path.commands)
}

const coordinate = (value: number | undefined) => Number((value ?? 0).toFixed(3))

/**
 * Commands as SVG path data with every contour closed. TrueType contours always are, but
 * opentype.js leaves the close out of a glyph it draws at variation axes, and an open contour
 * fills on its own rather than cutting the holes its direction cuts.
 */
function closedPathData(commands: readonly PathCommand[]): string {
  const parts: string[] = []
  let open = false
  for (const command of commands) {
    if (command.type === 'Z') continue
    if (command.type === 'M' && open) parts.push('Z')
    const points = [command.x1, command.y1, command.x2, command.y2].filter(
      (value) => value !== undefined
    )
    parts.push(`${command.type}${[...points, command.x, command.y].map(coordinate).join(' ')}`)
    open = true
  }
  if (open) parts.push('Z')
  return parts.join('')
}

/** A glyph as an icon path filling a `size` square, painted in the icon's color. */
export function materialSymbolsPath(
  font: MaterialSymbolsFont,
  glyph: number,
  size: number,
  axes: Record<string, number>
): IconPath {
  return {
    vectorNetwork: parseSVGPath(materialSymbolsPathData(font, glyph, size, axes), 'NONZERO'),
    fill: 'currentColor',
    stroke: null,
    strokeWidth: 0,
    strokeCap: 'butt',
    strokeJoin: 'miter'
  }
}
