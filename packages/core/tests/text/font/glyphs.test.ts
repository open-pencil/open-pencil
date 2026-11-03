import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { corePackagePath, FIXTURES } from '#core-tests/helpers/paths'

import { fontManager } from '@open-pencil/core/text'

import {
  getGlyphOutlineMetricsSync,
  glyphAdvanceSync,
  glyphOutlineSourceSync,
  measureTextWithFont
} from '#core/text/font/glyphs'

/** `faces` as one collection, as system CJK fonts ship: each face's table offsets move with it. */
function collectionOf(...faces: ArrayBuffer[]): ArrayBuffer {
  const header = 12 + faces.length * 4
  const bytes = new Uint8Array(header + faces.reduce((size, face) => size + face.byteLength, 0))
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x74746366)
  view.setUint32(4, 0x00010000)
  view.setUint32(8, faces.length)
  let start = header
  faces.forEach((face, index) => {
    bytes.set(new Uint8Array(face), start)
    view.setUint32(12 + index * 4, start)
    for (let table = 0; table < view.getUint16(start + 4); table++) {
      const offset = start + 12 + table * 16 + 8
      view.setUint32(offset, view.getUint32(offset) + start)
    }
    start += face.byteLength
  })
  return bytes.buffer
}

test('reads a font collection as its first face, as CanvasKit draws it', async () => {
  const fonts = join(FIXTURES, 'fonts')
  const chinese = await Bun.file(join(fonts, 'NotoSansSC-Regular.ttf')).arrayBuffer()
  const latin = await Bun.file(join(fonts, 'InterVariable-Latin.ttf')).arrayBuffer()
  await fontManager.markLoaded('Collection Test', 'Regular', collectionOf(chinese, latin))
  await fontManager.markLoaded('Collection Test Single', 'Regular', chinese)

  expect(glyphOutlineSourceSync('Collection Test', 'Regular')?.covers('中文')).toBe(true)
  const measured = measureTextWithFont('中文', 16, 'Collection Test', 'Regular')
  expect(measured).toEqual(measureTextWithFont('中文', 16, 'Collection Test Single', 'Regular'))
  expect(measured?.height).toBeGreaterThan(0)
})

test('measures default advances whatever instance of a variable font was last outlined', async () => {
  const family = 'OpenType Test Variable'
  await fontManager.markLoaded(
    family,
    'Regular',
    await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  )
  const source = glyphOutlineSourceSync(family, 'Regular', [{ axis: 'wght', value: 900 }])
  const glyph = source?.glyphOf('H') ?? 0
  const before = glyphAdvanceSync(family, 'Regular', glyph, 100)
  // Outlining an instance must not change the default instance's advances.
  source?.outline(glyph, 100)
  expect(glyphAdvanceSync(family, 'Regular', glyph, 100)).toBe(before)
})

test('outlines a shaped mark where shaping places it on its base letter', async () => {
  const family = 'HarfBuzz Test Marks'
  await fontManager.markLoaded(
    family,
    'Regular',
    await Bun.file(corePackagePath('assets', 'InterVariable.ttf')).arrayBuffer()
  )
  const [base, mark] = getGlyphOutlineMetricsSync(family, 'Regular', 'q́', 100) ?? []
  const xs = (mark?.commands ?? []).flatMap((command) => (command.x === undefined ? [] : [command.x]))
  expect(xs.length).toBeGreaterThan(0)
  // The acute's pen is past the q; its outline reaches back over the q.
  expect(mark?.x).toBe(base?.advance)
  expect(Math.max(...xs)).toBeLessThan(0)
})
