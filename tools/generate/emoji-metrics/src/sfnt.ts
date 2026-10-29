/** Reading and writing the table directory of a TrueType font (`sfnt`), which is all it needs. */

export type FontTables = Map<string, Uint8Array>

export function readFontTables(bytes: Uint8Array): FontTables {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tables: FontTables = new Map()
  const count = view.getUint16(4)
  for (let index = 0; index < count; index++) {
    const record = 12 + index * 16
    const tag = String.fromCharCode(...bytes.subarray(record, record + 4))
    const offset = view.getUint32(record + 8)
    const length = view.getUint32(record + 12)
    tables.set(tag, bytes.subarray(offset, offset + length))
  }
  return tables
}

function checksum(data: Uint8Array): number {
  const padded = new Uint8Array(Math.ceil(data.length / 4) * 4)
  padded.set(data)
  const view = new DataView(padded.buffer)
  let sum = 0
  for (let offset = 0; offset < padded.length; offset += 4) {
    sum = (sum + view.getUint32(offset)) >>> 0
  }
  return sum
}

/** A TrueType font holding `tables`, with its checksums and `head` adjustment worked out. */
export function writeFontTables(tables: FontTables): Uint8Array {
  const tags = [...tables.keys()].sort()
  const headerLength = 12 + tags.length * 16
  let length = headerLength
  for (const tag of tags) length += Math.ceil((tables.get(tag)?.length ?? 0) / 4) * 4
  const bytes = new Uint8Array(length)
  const view = new DataView(bytes.buffer)
  const searchPower = 2 ** Math.floor(Math.log2(tags.length))
  view.setUint32(0, 0x00010000)
  view.setUint16(4, tags.length)
  view.setUint16(6, searchPower * 16)
  view.setUint16(8, Math.log2(searchPower))
  view.setUint16(10, tags.length * 16 - searchPower * 16)
  let offset = headerLength
  let headOffset = -1
  for (const [index, tag] of tags.entries()) {
    const data = new Uint8Array(tables.get(tag) ?? new Uint8Array())
    // The checksums count `head`'s adjustment as zero; a source font's own value would skew both.
    if (tag === 'head') data.fill(0, 8, 12)
    const record = 12 + index * 16
    for (let char = 0; char < 4; char++) bytes[record + char] = tag.charCodeAt(char)
    view.setUint32(record + 4, checksum(data))
    view.setUint32(record + 8, offset)
    view.setUint32(record + 12, data.length)
    bytes.set(data, offset)
    if (tag === 'head') headOffset = offset
    offset += Math.ceil(data.length / 4) * 4
  }
  if (headOffset >= 0) view.setUint32(headOffset + 8, (0xb1b0afba - checksum(bytes)) >>> 0)
  return bytes
}
