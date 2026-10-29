/** Reading a font's character map and writing one back, as format 4 and format 12 subtables. */

export type CharacterMap = Map<number, number>

/** The code points of the font's full Unicode subtable (format 12) and the glyphs they map to. */
export function readCharacterMap(cmap: Uint8Array): CharacterMap {
  const view = new DataView(cmap.buffer, cmap.byteOffset, cmap.byteLength)
  const map: CharacterMap = new Map()
  const count = view.getUint16(2)
  for (let index = 0; index < count; index++) {
    const offset = view.getUint32(4 + index * 8 + 4)
    if (view.getUint16(offset) !== 12) continue
    const groups = view.getUint32(offset + 12)
    for (let group = 0; group < groups; group++) {
      const record = offset + 16 + group * 12
      const start = view.getUint32(record)
      const end = view.getUint32(record + 4)
      const glyph = view.getUint32(record + 8)
      for (let codePoint = start; codePoint <= end; codePoint++)
        map.set(codePoint, glyph + codePoint - start)
    }
    return map
  }
  throw new Error('The source font has no format 12 character map')
}

/** Runs of consecutive code points mapping to consecutive glyphs. */
function groupsOf(map: CharacterMap): Array<[start: number, end: number, glyph: number]> {
  const groups: Array<[number, number, number]> = []
  for (const codePoint of [...map.keys()].sort((a, b) => a - b)) {
    const glyph = map.get(codePoint) ?? 0
    const last = groups.at(-1)
    if (last && codePoint === last[1] + 1 && glyph === last[2] + codePoint - last[0])
      last[1] = codePoint
    else groups.push([codePoint, codePoint, glyph])
  }
  return groups
}

function format12(map: CharacterMap): Uint8Array {
  const groups = groupsOf(map)
  const bytes = new Uint8Array(16 + groups.length * 12)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, 12)
  view.setUint32(4, bytes.length)
  view.setUint32(12, groups.length)
  for (const [index, [start, end, glyph]] of groups.entries()) {
    view.setUint32(16 + index * 12, start)
    view.setUint32(20 + index * 12, end)
    view.setUint32(24 + index * 12, glyph)
  }
  return bytes
}

/** The Basic Multilingual Plane part, as segments with explicit glyph offsets. */
function format4(map: CharacterMap): Uint8Array {
  const segments = groupsOf(new Map([...map].filter(([codePoint]) => codePoint <= 0xfffe)))
  segments.push([0xffff, 0xffff, 0])
  const count = segments.length
  const bytes = new Uint8Array(16 + count * 8)
  const view = new DataView(bytes.buffer)
  const searchPower = 2 ** Math.floor(Math.log2(count))
  view.setUint16(0, 4)
  view.setUint16(2, bytes.length)
  view.setUint16(6, count * 2)
  view.setUint16(8, searchPower * 2)
  view.setUint16(10, Math.log2(searchPower))
  view.setUint16(12, count * 2 - searchPower * 2)
  const ends = 14
  const starts = ends + count * 2 + 2
  const deltas = starts + count * 2
  const rangeOffsets = deltas + count * 2
  for (const [index, [start, end, glyph]] of segments.entries()) {
    view.setUint16(ends + index * 2, end)
    view.setUint16(starts + index * 2, start)
    // The final segment maps U+FFFF to the missing glyph.
    view.setUint16(deltas + index * 2, end === 0xffff ? 1 : (glyph - start) & 0xffff)
    view.setUint16(rangeOffsets + index * 2, 0)
  }
  return bytes
}

/** A character map with `map` as Unicode BMP (format 4) and full (format 12) subtables. */
export function writeCharacterMap(map: CharacterMap): Uint8Array {
  const subtables: Array<[platform: number, encoding: number, data: Uint8Array]> = [
    [0, 3, format4(map)],
    [0, 4, format12(map)],
    [3, 1, format4(map)],
    [3, 10, format12(map)]
  ]
  const header = 4 + subtables.length * 8
  const bytes = new Uint8Array(
    header + subtables.reduce((total, [, , data]) => total + data.length, 0)
  )
  const view = new DataView(bytes.buffer)
  view.setUint16(2, subtables.length)
  let offset = header
  for (const [index, [platform, encoding, data]] of subtables.entries()) {
    view.setUint16(4 + index * 8, platform)
    view.setUint16(6 + index * 8, encoding)
    view.setUint32(8 + index * 8, offset)
    bytes.set(data, offset)
    offset += data.length
  }
  return bytes
}
