import { sfntTable } from './variation'

/** Maps a code point to the font's glyph for it, 0 when it has none. */
type GlyphLookup = (codePoint: number) => number

const COLLECTION_TAG = 0x74746366 // 'ttcf'

/**
 * Where the table directory of the face CanvasKit draws from a file starts: the file's own, or
 * the first face of a collection such as a system CJK `.ttc`.
 */
function firstFaceDirectory(view: DataView): number | null {
  if (view.byteLength < 12) return null
  if (view.getUint32(0) !== COLLECTION_TAG) return 0
  return view.byteLength >= 16 ? view.getUint32(12) : null
}

function format12(view: DataView, start: number): GlyphLookup {
  const groups = view.getUint32(start + 12)
  return (codePoint) => {
    let low = 0
    let high = groups - 1
    while (low <= high) {
      const middle = (low + high) >> 1
      const group = start + 16 + middle * 12
      const first = view.getUint32(group)
      const last = view.getUint32(group + 4)
      if (codePoint < first) high = middle - 1
      else if (codePoint > last) low = middle + 1
      else return view.getUint32(group + 8) + codePoint - first
    }
    return 0
  }
}

function format4(view: DataView, start: number): GlyphLookup {
  const segments = view.getUint16(start + 6) / 2
  const ends = start + 14
  const starts = ends + segments * 2 + 2
  const deltas = starts + segments * 2
  const rangeOffsets = deltas + segments * 2
  return (codePoint) => {
    if (codePoint > 0xffff) return 0
    for (let segment = 0; segment < segments; segment++) {
      if (codePoint > view.getUint16(ends + segment * 2)) continue
      const first = view.getUint16(starts + segment * 2)
      if (codePoint < first) return 0
      const delta = view.getUint16(deltas + segment * 2)
      const rangeOffsetAt = rangeOffsets + segment * 2
      const rangeOffset = view.getUint16(rangeOffsetAt)
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff
      const glyphAt = rangeOffsetAt + rangeOffset + (codePoint - first) * 2
      if (glyphAt + 2 > view.byteLength) return 0
      const glyph = view.getUint16(glyphAt)
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff
    }
    return 0
  }
}

/** The Unicode subtable a shaper reads, full-repertoire (format 12) before BMP-only (format 4). */
function unicodeLookup(data: ArrayBuffer): GlyphLookup | null {
  const view = new DataView(data)
  const directory = firstFaceDirectory(view)
  if (directory === null) return null
  const cmap = sfntTable(view, 'cmap', directory)
  if (!cmap || cmap.length < 4) return null
  const count = view.getUint16(cmap.offset + 2)
  let bmp: GlyphLookup | null = null
  for (let index = 0; index < count; index++) {
    const record = cmap.offset + 4 + index * 8
    if (record + 8 > cmap.offset + cmap.length) break
    const platform = view.getUint16(record)
    const encoding = view.getUint16(record + 2)
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))
    if (!unicode) continue
    const start = cmap.offset + view.getUint32(record + 4)
    if (start + 4 > view.byteLength) continue
    const format = view.getUint16(start)
    if (format === 12) return format12(view, start)
    if (format === 4) bmp ??= format4(view, start)
  }
  return bmp
}

const lookups = new WeakMap<ArrayBuffer, GlyphLookup | null>()

/**
 * Whether the face CanvasKit draws from `data` maps `character` to a glyph, read from its
 * `cmap` without copying the file into a shaper; `null` when the file has no table to say.
 */
export function fontFileMapsCharacter(data: ArrayBuffer, character: string): boolean | null {
  let lookup = lookups.get(data)
  if (lookup === undefined) {
    lookup = unicodeLookup(data)
    lookups.set(data, lookup)
  }
  const codePoint = character.codePointAt(0)
  if (!lookup || codePoint === undefined) return null
  return lookup(codePoint) !== 0
}
