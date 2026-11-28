import { readFile } from 'node:fs/promises'

import { repoPath } from '@open-pencil/test-support/paths'

/** Fonts the tests read as if installed: static, variable, CFF, and a second family. */
export const FONT_FIXTURES = {
  interSemiBold: repoPath('packages/core/assets/Inter-SemiBold.ttf'),
  interVariable: repoPath('packages/core/assets/InterVariable.ttf'),
  naskh: repoPath('packages/core/assets/NotoNaskhArabic-Regular.ttf'),
  cjk: repoPath('tests/fixtures/fonts/NotoSansCJK-Test.otf')
}

const OFFSET_TABLE_SIZE = 12
const TABLE_RECORD_SIZE = 16

/**
 * A font collection (`.ttc`) of whole single-font files, each placed after the collection's
 * header with its table offsets moved to where its tables now lie.
 */
export async function fontCollection(paths: readonly string[]): Promise<Uint8Array<ArrayBuffer>> {
  const fonts = await Promise.all(paths.map(async (path) => new Uint8Array(await readFile(path))))
  const headerSize = OFFSET_TABLE_SIZE + fonts.length * 4
  const starts = fonts.map((_, i) =>
    fonts.slice(0, i).reduce((offset, font) => offset + font.byteLength, headerSize)
  )
  const collection = new Uint8Array(
    fonts.reduce((size, font) => size + font.byteLength, headerSize)
  )
  const view = new DataView(collection.buffer)
  collection.set(new TextEncoder().encode('ttcf'), 0)
  view.setUint32(4, 0x00010000)
  view.setUint32(8, fonts.length)
  for (const [i, font] of fonts.entries()) {
    const start = starts[i] ?? headerSize
    view.setUint32(OFFSET_TABLE_SIZE + i * 4, start)
    collection.set(font, start)
    const tables = view.getUint16(start + 4)
    for (let t = 0; t < tables; t++) {
      const offset = start + OFFSET_TABLE_SIZE + t * TABLE_RECORD_SIZE + 8
      view.setUint32(offset, view.getUint32(offset) + start)
    }
  }
  return collection
}
