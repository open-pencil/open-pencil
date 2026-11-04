import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '#core-tests/helpers/paths'

import { isVariableFont, isWOFF2, sfntFont } from '@open-pencil/core/text'

const font = (name: string) => Bun.file(join(FIXTURES, 'fonts', name)).arrayBuffer()

describe('sfntFont', () => {
  test('decompresses a WOFF2 font into the TrueType font it holds, axes included', async () => {
    const woff2 = await font('InterVariable-Faces.woff2')
    expect(isWOFF2(woff2)).toBe(true)
    const sfnt = await sfntFont(woff2)
    expect(isWOFF2(sfnt)).toBe(false)
    expect(new DataView(sfnt).getUint32(0)).toBe(0x00010000)
    expect(isVariableFont(sfnt)).toBe(true)
  })

  test('keeps an sfnt font as it is', async () => {
    const ttf = await font('InterVariable-Latin.ttf')
    expect(await sfntFont(ttf)).toBe(ttf)
  })
})
