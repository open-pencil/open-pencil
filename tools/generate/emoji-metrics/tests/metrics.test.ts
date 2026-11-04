import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { readCharacterMap } from '#emoji-metrics/cmap'
import { EMOJI_METRICS_ASSET, EMOJI_METRICS_FAMILY } from '#emoji-metrics/metrics'
import { readFontTables } from '#emoji-metrics/sfnt'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

async function committedFont() {
  const root = await resolveWorkspaceRoot(import.meta.dir)
  return readFontTables(
    new Uint8Array(await readFile(join(root, 'packages/core/assets', EMOJI_METRICS_ASSET)))
  )
}

function required(tables: Map<string, Uint8Array>, tag: string): DataView {
  const table = tables.get(tag)
  if (!table) throw new Error(`missing ${tag}`)
  return new DataView(table.buffer, table.byteOffset, table.byteLength)
}

test('the committed metrics font gives each emoji 1 em and its joiners none', async () => {
  const tables = await committedFont()
  const unitsPerEm = required(tables, 'head').getUint16(18)
  const hmtx = required(tables, 'hmtx')
  const characters = readCharacterMap(tables.get('cmap') ?? new Uint8Array())
  const advance = (codePoint: number) => {
    const glyph = characters.get(codePoint)
    return glyph === undefined ? undefined : hmtx.getUint16(glyph * 4)
  }

  expect(advance(0x1f600)).toBe(unitsPerEm)
  expect(advance(0x1f1fa)).toBe(unitsPerEm)
  expect(advance(0x200d)).toBe(0)
  // Keycaps keep the text font's character and Core draws their frame, as Figma draws them.
  expect(advance(0x20e3)).toBeUndefined()
  expect([...characters.keys()].some((codePoint) => codePoint < 0x80)).toBe(false)
  expect(tables.has('CBDT') || tables.has('COLR') || tables.has('SVG ')).toBe(false)
})

test('the committed metrics font registers under the family Core falls back to', async () => {
  const name = (await committedFont()).get('name') ?? new Uint8Array()
  const text = new TextDecoder('utf-16be').decode(name)
  expect(text).toContain(EMOJI_METRICS_FAMILY)
})
