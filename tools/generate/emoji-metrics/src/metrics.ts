import { readCharacterMap, writeCharacterMap } from './cmap'
import { COMBINING_KEYCAP } from './keycap'
import type { FontTables } from './sfnt'

/** The family the metrics font registers under, which the editor's text layout falls back to. */
export const EMOJI_METRICS_FAMILY = 'OpenPencil Emoji Metrics'

/** Its file among Core's bundled fonts. */
export const EMOJI_METRICS_ASSET = 'OpenPencilEmojiMetrics-Regular.ttf'

/** Tables carried over unchanged: how emoji sequences join, and the font's basic metadata. */
const KEPT_TABLES = ['GSUB', 'OS/2', 'post'] as const

/**
 * Noto maps ASCII digits, `#`, `*`, the space, and the combining keycap for its keycap sequences.
 * Figma draws a keycap as the text font's character with a keycap frame after it, which Core
 * draws itself, so none of them are the metrics font's.
 */
const TEXT_CHARACTER_LIMIT = 0x80

/**
 * The missing glyph's outline: a glyph header with no contours, all zero. Browsers' font
 * sanitizer rejects an empty `glyf` table, so the font keeps this one valid, empty outline.
 */
const NOTDEF_OUTLINE = 10

function required(tables: FontTables, tag: string): Uint8Array {
  const table = tables.get(tag)
  if (!table) throw new Error(`The source font has no ${tag} table`)
  return table
}

function copy(table: Uint8Array): Uint8Array {
  return new Uint8Array(table)
}

function nameTable(family: string, copyright: string): Uint8Array {
  const records: Array<[number, string]> = [
    [0, copyright],
    [1, family],
    [2, 'Regular'],
    [3, `${family} Regular`],
    [4, `${family} Regular`],
    [5, 'Version 1.000'],
    [6, family.replaceAll(' ', '') + '-Regular']
  ]
  const strings = records.map(([, text]) => {
    const encoded = new Uint8Array(text.length * 2)
    const view = new DataView(encoded.buffer)
    for (let index = 0; index < text.length; index++)
      view.setUint16(index * 2, text.charCodeAt(index))
    return encoded
  })
  const storageOffset = 6 + records.length * 12
  const bytes = new Uint8Array(
    storageOffset + strings.reduce((total, data) => total + data.length, 0)
  )
  const view = new DataView(bytes.buffer)
  view.setUint16(2, records.length)
  view.setUint16(4, storageOffset)
  let offset = 0
  for (const [index, [nameID]] of records.entries()) {
    const record = 6 + index * 12
    view.setUint16(record, 3)
    view.setUint16(record + 2, 1)
    view.setUint16(record + 4, 0x409)
    view.setUint16(record + 6, nameID)
    view.setUint16(record + 8, strings[index].length)
    view.setUint16(record + 10, offset)
    bytes.set(strings[index], storageOffset + offset)
    offset += strings[index].length
  }
  return bytes
}

/**
 * A font that lays emoji out as Figma does and draws nothing: the source's characters and
 * sequences, each emoji 1 em wide and every joiner, tag, or selector it gives no width still
 * without one, and empty outlines. Figma saves every emoji as a 1 em square, in design files and
 * FigJam alike, so the editor's text layout uses this for emoji and their images are drawn over.
 */
export function emojiMetricsFont(source: FontTables, copyright: string): FontTables {
  const head = copy(required(source, 'head'))
  const hhea = copy(required(source, 'hhea'))
  const maxp = copy(required(source, 'maxp'))
  const sourceMetrics = required(source, 'hmtx')
  const headView = new DataView(head.buffer)
  const hheaView = new DataView(hhea.buffer)
  const unitsPerEm = headView.getUint16(18)
  const glyphCount = new DataView(maxp.buffer).getUint16(4)
  const sourceMetricCount = hheaView.getUint16(34)
  const sourceView = new DataView(
    sourceMetrics.buffer,
    sourceMetrics.byteOffset,
    sourceMetrics.byteLength
  )

  const characters = new Map(
    [...readCharacterMap(required(source, 'cmap'))].filter(
      ([codePoint]) => codePoint >= TEXT_CHARACTER_LIMIT && codePoint !== COMBINING_KEYCAP
    )
  )

  const hmtx = new Uint8Array(glyphCount * 4)
  const hmtxView = new DataView(hmtx.buffer)
  for (let glyph = 0; glyph < glyphCount; glyph++) {
    const advance = sourceView.getUint16(Math.min(glyph, sourceMetricCount - 1) * 4)
    hmtxView.setUint16(glyph * 4, advance > 0 ? unitsPerEm : 0)
  }
  // Short offsets, in words: the missing glyph holds the only outline, and every other is empty.
  headView.setInt16(50, 0)
  const loca = new Uint8Array((glyphCount + 1) * 2)
  const locaView = new DataView(loca.buffer)
  for (let glyph = 1; glyph <= glyphCount; glyph++)
    locaView.setUint16(glyph * 2, NOTDEF_OUTLINE / 2)
  hheaView.setUint16(10, unitsPerEm)
  for (const field of [12, 14, 16]) hheaView.setInt16(field, 0)
  hheaView.setUint16(34, glyphCount)

  const tables: FontTables = new Map([
    ['head', head],
    ['hhea', hhea],
    ['maxp', maxp],
    ['hmtx', hmtx],
    ['loca', loca],
    ['glyf', new Uint8Array(NOTDEF_OUTLINE)],
    ['name', nameTable(EMOJI_METRICS_FAMILY, copyright)],
    ['cmap', writeCharacterMap(characters)]
  ])
  for (const tag of KEPT_TABLES) tables.set(tag, copy(required(source, tag)))
  return tables
}
