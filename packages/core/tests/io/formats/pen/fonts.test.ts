import { describe, expect, spyOn, test } from 'bun:test'

import { IORegistry, penFormat } from '@open-pencil/core/io'
import { fontManager } from '@open-pencil/core/text'
import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'
import { repoPath } from '@open-pencil/test-support/paths'

const io = new IORegistry([penFormat])

const fontFile = async (name: string, folder = 'packages/core/assets') =>
  new Uint8Array(await Bun.file(repoPath(`${folder}/${name}`)).arrayBuffer())

/** A document `My Design.pen` bundling `fonts`, with one text layer in each `families`. */
async function read(fonts: { name: string; url: string }[], families: string[]) {
  const files = new Map([
    ['My Design-assets/Inter-SemiBold.ttf', await fontFile('Inter-SemiBold.ttf')],
    ['My Design-assets/NotoNaskhArabic-Regular.ttf', await fontFile('NotoNaskhArabic-Regular.ttf')],
    [
      'My Design-assets/InterVariable-Faces.woff2',
      await fontFile('InterVariable-Faces.woff2', 'tests/fixtures/fonts')
    ]
  ])
  const asked: string[] = []
  const { graph } = await io.readDocument({
    name: 'My Design.pen',
    data: new TextEncoder().encode(
      JSON.stringify({
        version: '2.21',
        fonts,
        children: families.map((fontFamily, index) => ({
          id: `t${index}`,
          type: 'text',
          content: 'Hello',
          fontFamily,
          fontWeight: 'normal'
        }))
      })
    ),
    readAsset: async (path) => {
      asked.push(path)
      return files.get(path) ?? null
    }
  })
  return { graph, asked }
}

describe('penFormat.readDocument — bundled fonts (#1759)', () => {
  test('sets text in the family and style its bundled file names itself with', async () => {
    const { graph, asked } = await read(
      [{ name: 'Inter-SemiBold', url: 'My%20Design-assets/Inter-SemiBold.ttf' }],
      ['Inter-SemiBold']
    )
    expect(asked).toEqual(['My Design-assets/Inter-SemiBold.ttf'])
    expect(getNodeOrThrow(graph, 't0')).toMatchObject({
      fontFamily: 'Inter',
      fontStyle: 'SemiBold',
      fontWeight: 600,
      italic: false
    })
  })

  test('registers the bundled file under those names', async () => {
    // Other tests register this font too, so the call itself is what shows this read made it.
    const markLoaded = spyOn(fontManager, 'markLoaded')
    try {
      await read(
        [{ name: 'Naskh', url: 'My%20Design-assets/NotoNaskhArabic-Regular.ttf' }],
        ['Naskh']
      )
      const file = await fontFile('NotoNaskhArabic-Regular.ttf')
      expect(markLoaded).toHaveBeenCalledWith('Noto Naskh Arabic', 'Regular', file.buffer)
    } finally {
      markLoaded.mockRestore()
    }
  })

  test('reads a bundled WOFF2 file, registering it decompressed', async () => {
    const markLoaded = spyOn(fontManager, 'markLoaded')
    try {
      const { graph } = await read(
        [{ name: 'Inter-Web', url: 'My%20Design-assets/InterVariable-Faces.woff2' }],
        ['Inter-Web']
      )
      expect(getNodeOrThrow(graph, 't0')).toMatchObject({
        fontFamily: 'Inter Variable',
        fontStyle: 'Regular'
      })
      const call = markLoaded.mock.calls.find(([family]) => family === 'Inter Variable')
      // An sfnt with TrueType outlines, not the `wOF2` file it came as.
      expect(new DataView(expectDefined(call, 'registration')[2]).getUint32(0)).toBe(0x00010000)
    } finally {
      markLoaded.mockRestore()
    }
  })

  test('keeps the name of a bundled font whose file cannot be read', async () => {
    const { graph } = await read(
      [{ name: 'Geist-SemiBold', url: 'My%20Design-assets/Geist-SemiBold.ttf' }],
      ['Geist-SemiBold']
    )
    expect(getNodeOrThrow(graph, 't0')).toMatchObject({
      fontFamily: 'Geist-SemiBold',
      fontWeight: 400
    })
  })
})
