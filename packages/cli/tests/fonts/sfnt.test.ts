import { describe, expect, test } from 'bun:test'
import { mkdtemp, open, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { FONT_FIXTURES, fontCollection } from '#cli-tests/helpers/fonts'

import { fontFaceName } from '@open-pencil/core/text'

import {
  hasDrawableOutlines,
  readSfntFaces,
  readTableSubset,
  standaloneFace,
  type SfntFace
} from '#cli/fonts/sfnt'

async function tempFile(name: string, data: Uint8Array): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), 'open-pencil-sfnt-')), name)
  await writeFile(path, data)
  return path
}

async function facesOf(path: string): Promise<SfntFace[]> {
  const file = await open(path)
  try {
    return await readSfntFaces(file)
  } finally {
    await file.close()
  }
}

function face(tags: string[]): SfntFace {
  return { index: 0, offset: 0, tables: tags.map((tag) => ({ tag, offset: 0, length: 0 })) }
}

describe('readSfntFaces', () => {
  test('reads a single font as one face with its tables', async () => {
    const [only, ...rest] = await facesOf(FONT_FIXTURES.interSemiBold)
    expect(rest).toEqual([])
    expect(only?.offset).toBe(0)
    expect(only?.tables.map((table) => table.tag)).toContain('name')
  })

  test('reads each face of a collection', async () => {
    const path = await tempFile(
      'pair.ttc',
      await fontCollection([FONT_FIXTURES.interSemiBold, FONT_FIXTURES.naskh])
    )
    const faces = await facesOf(path)
    expect(faces.map((entry) => entry.index)).toEqual([0, 1])
    expect(faces[1]?.offset).toBeGreaterThan(0)
  })

  test('reads no face from a file that is not a font', async () => {
    expect(await facesOf(await tempFile('short.ttf', new Uint8Array(6)))).toEqual([])
    const woff = new Uint8Array(await readFile(FONT_FIXTURES.naskh))
    woff.set(new TextEncoder().encode('wOFF'))
    expect(await facesOf(await tempFile('renamed.ttf', woff))).toEqual([])
    const collection = new Uint8Array(12)
    collection.set(new TextEncoder().encode('ttcf'))
    new DataView(collection.buffer).setUint32(8, 3)
    expect(await facesOf(await tempFile('cut.ttc', collection))).toEqual([])
  })

  test('reads no face whose tables reach past the end of the file', async () => {
    const font = new Uint8Array(await readFile(FONT_FIXTURES.naskh))
    // The first table claims four gigabytes, which a buffer sized by it could not hold.
    new DataView(font.buffer).setUint32(12 + 12, 0xffffffff)
    expect(await facesOf(await tempFile('long.ttf', font))).toEqual([])
  })

  test('reads no face of a collection whose directory lies inside its header', async () => {
    const collection = await fontCollection([FONT_FIXTURES.interSemiBold, FONT_FIXTURES.naskh])
    new DataView(collection.buffer).setUint32(12, 0)
    expect(await facesOf(await tempFile('overlap.ttc', collection))).toEqual([])
  })
})

describe('readTableSubset', () => {
  test('keeps the names of the face it reads', async () => {
    const path = await tempFile(
      'pair.ttc',
      await fontCollection([FONT_FIXTURES.interSemiBold, FONT_FIXTURES.naskh])
    )
    const file = await open(path)
    try {
      const faces = await readSfntFaces(file)
      const names = await Promise.all(
        faces.map(async (entry) => {
          const subset = await readTableSubset(file, entry, ['name', 'OS/2'])
          return subset && fontFaceName(subset)
        })
      )
      expect(names).toEqual([
        { family: 'Inter', style: 'SemiBold' },
        { family: 'Noto Naskh Arabic', style: 'Regular' }
      ])
    } finally {
      await file.close()
    }
  })
})

describe('standaloneFace', () => {
  test('moves a collection face to the front, leaving the tables in place', async () => {
    const data = await fontCollection([FONT_FIXTURES.interSemiBold, FONT_FIXTURES.naskh])
    const faces = await facesOf(await tempFile('pair.ttc', data))
    const second = faces[1]
    if (!second) throw new Error('the collection has two faces')
    const standalone = standaloneFace(new Uint8Array(data), second)
    expect(standalone?.byteLength).toBe(data.byteLength)
    expect(standalone && fontFaceName(standalone.buffer)).toEqual({
      family: 'Noto Naskh Arabic',
      style: 'Regular'
    })
  })

  test("keeps a collection's first face where it is, standing alone already", async () => {
    const data = await fontCollection([FONT_FIXTURES.interSemiBold, FONT_FIXTURES.naskh])
    const [first] = await facesOf(await tempFile('pair.ttc', data))
    if (!first) throw new Error('the collection has a face')
    const standalone = standaloneFace(new Uint8Array(data), first)
    expect(standalone && fontFaceName(standalone.buffer)).toEqual({
      family: 'Inter',
      style: 'SemiBold'
    })
  })

  test('refuses a face whose tables the moved directory would overwrite', () => {
    const data = new Uint8Array(64)
    const face: SfntFace = { index: 1, offset: 32, tables: [{ tag: 'name', offset: 8, length: 4 }] }
    expect(standaloneFace(data, face)).toBeNull()
  })

  test('keeps a single font as it is', async () => {
    const data = new Uint8Array(await readFile(FONT_FIXTURES.naskh))
    const [only] = await facesOf(FONT_FIXTURES.naskh)
    if (!only) throw new Error('the font has a face')
    expect(standaloneFace(data, only)).toBe(data)
  })
})

describe('hasDrawableOutlines', () => {
  test('draws TrueType and CFF outlines but not Apple hvgl ones', () => {
    expect(hasDrawableOutlines(face(['cmap', 'glyf', 'loca']))).toBe(true)
    expect(hasDrawableOutlines(face(['CFF ', 'cmap']))).toBe(true)
    expect(hasDrawableOutlines(face(['CFF2', 'cmap']))).toBe(true)
    expect(hasDrawableOutlines(face(['cmap', 'fvar', 'hvgl', 'name']))).toBe(false)
  })
})
