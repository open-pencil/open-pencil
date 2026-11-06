import { describe, expect, test } from 'bun:test'

import { IORegistry, penFormat } from '@open-pencil/core/io'
import { fontManager } from '@open-pencil/core/text'
import { getNodeOrThrow } from '@open-pencil/test-support/assert'
import { repoPath } from '@open-pencil/test-support/paths'

const io = new IORegistry([penFormat])

const fontFile = async (name: string) =>
  new Uint8Array(await Bun.file(repoPath(`packages/core/assets/${name}`)).arrayBuffer())

/** A document `My Design.pen` bundling `fonts`, with one text layer in each `families`. */
async function read(fonts: { name: string; url: string }[], families: string[]) {
  const files = new Map([
    ['My Design-assets/Inter-SemiBold.ttf', await fontFile('Inter-SemiBold.ttf')],
    ['My Design-assets/NotoNaskhArabic-Regular.ttf', await fontFile('NotoNaskhArabic-Regular.ttf')]
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
    await read(
      [{ name: 'Naskh', url: 'My%20Design-assets/NotoNaskhArabic-Regular.ttf' }],
      ['Naskh']
    )
    expect(fontManager.loadedFontSource('Noto Naskh Arabic', 'Regular')).toBe('registered')
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
