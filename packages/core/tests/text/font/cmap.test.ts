import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '#core-tests/helpers/paths'

import { fontFileMapsCharacter } from '#core/text/font/cmap'

const font = (name: string) => Bun.file(join(FIXTURES, 'fonts', name)).arrayBuffer()

/** `data` as the only face of a collection, as system CJK fonts ship: table offsets move by 16. */
function collectionOf(data: ArrayBuffer): ArrayBuffer {
  const header = 16
  const bytes = new Uint8Array(header + data.byteLength)
  bytes.set(new Uint8Array(data), header)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x74746366)
  view.setUint32(4, 0x00010000)
  view.setUint32(8, 1)
  view.setUint32(12, header)
  const tables = view.getUint16(header + 4)
  for (let index = 0; index < tables; index++) {
    const offset = header + 12 + index * 16 + 8
    view.setUint32(offset, view.getUint32(offset) + header)
  }
  return bytes.buffer
}

test('reads which characters a font maps from its cmap', async () => {
  const chinese = await font('NotoSansSC-Regular.ttf')
  expect(fontFileMapsCharacter(chinese, '中')).toBe(true)
  expect(fontFileMapsCharacter(chinese, 'の')).toBe(true)
  expect(fontFileMapsCharacter(chinese, '한')).toBe(false)
  const latin = await font('InterVariable-Latin.ttf')
  expect(fontFileMapsCharacter(latin, 'A')).toBe(true)
  expect(fontFileMapsCharacter(latin, '中')).toBe(false)
})

test('reads the first face of a collection, the one CanvasKit draws', async () => {
  const collection = collectionOf(await font('NotoSansSC-Regular.ttf'))
  expect(fontFileMapsCharacter(collection, '中')).toBe(true)
  expect(fontFileMapsCharacter(collection, '한')).toBe(false)
})

test('cannot say for a file with no font tables', () => {
  expect(fontFileMapsCharacter(new ArrayBuffer(16), '中')).toBeNull()
})
