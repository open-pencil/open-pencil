import { describe, expect, test } from 'bun:test'

import { fromUint8Array, toUint8Array } from 'js-base64'

import type { IconData, IconProvider } from '@open-pencil/core/icons'
import { IORegistry, penFormat } from '@open-pencil/core/io'
import { readIcon, type IconOptions } from '@open-pencil/scene-graph/icons'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import { getNodeOrThrow } from '@open-pencil/test-support/assert'

// A 2 × 1 PNG.
const PNG = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADElEQVR4nGP8zwACAAYIAQFazwZIAAAAAElFTkSuQmCC'
)

interface IconRequest {
  names: string[]
  options?: IconOptions
}

function iconProvider(available: string[], requested: IconRequest[]): IconProvider {
  const glyph = (name: string, size: number, options?: IconOptions): IconData => {
    const [prefix = '', iconName = ''] = name.split(':')
    return {
      prefix,
      name: iconName,
      width: size,
      height: size,
      paths: [
        {
          vectorNetwork: parseSVGPath(`M0 0H${size}V${size}Z`),
          fill: 'currentColor',
          stroke: null,
          strokeWidth: 0,
          strokeCap: 'butt',
          strokeJoin: 'miter'
        }
      ],
      ...(options ? { options } : {})
    }
  }
  return {
    async icons(names, size, options) {
      requested.push(options ? { names: [...names], options } : { names: [...names] })
      return new Map(
        names
          .filter((name) => available.includes(name))
          .map((name) => [name, glyph(name, size, options)])
      )
    },
    search: () => Promise.resolve({ icons: [], total: 0, collections: {} }),
    previews: () => Promise.resolve(new Map()),
    collections: () => Promise.resolve([]),
    browse: () => Promise.resolve([])
  }
}

const io = new IORegistry([penFormat])

function penBytes(children: unknown[]) {
  return new TextEncoder().encode(JSON.stringify({ version: '2.21', children }))
}

describe('penFormat.readDocument — assets', () => {
  test('draws every library from its set, Material Symbols at their weight', async () => {
    const requested: IconRequest[] = []
    const icons = iconProvider(['lucide:house', 'material-symbols-outlined:home'], requested)
    const { graph } = await io.readDocument(
      {
        name: 'icons.pen',
        data: penBytes([
          { id: 'house', type: 'icon', library: 'lucide', icon: 'house', width: 48, height: 48 },
          {
            id: 'symbol',
            type: 'icon',
            library: 'Material Symbols Outlined',
            icon: 'home',
            weight: 650,
            width: 48,
            height: 48
          }
        ])
      },
      { icons }
    )
    expect(requested).toEqual(
      expect.arrayContaining([
        { names: ['lucide:house'] },
        { names: ['material-symbols-outlined:home'], options: { wght: 650 } }
      ])
    )
    expect(readIcon(getNodeOrThrow(graph, 'house'))).toMatchObject({ name: 'lucide:house' })
    expect(readIcon(getNodeOrThrow(graph, 'symbol'))).toMatchObject({
      name: 'material-symbols-outlined:home',
      options: { wght: 650 }
    })
    expect(graph.getChildren('symbol').map((glyph) => glyph.type)).toEqual(['VECTOR'])
  })

  test('reads image files through the host and leaves unreadable ones unpainted', async () => {
    const asked: string[] = []
    const { graph } = await io.readDocument(
      {
        name: 'images.pen',
        data: penBytes([
          {
            id: 'photo',
            type: 'rectangle',
            width: 20,
            height: 10,
            fill: { type: 'image', url: './photo.png' }
          },
          {
            id: 'gone',
            type: 'rectangle',
            width: 20,
            height: 10,
            fill: { type: 'image', url: './gone.png' }
          }
        ]),
        readAsset: async (path) => {
          asked.push(path)
          return path === './photo.png' ? PNG : null
        }
      },
      { icons: iconProvider([], []) }
    )
    expect([...asked].sort()).toEqual(['./gone.png', './photo.png'])
    expect(graph.getNode('photo')?.fills[0]?.type).toBe('IMAGE')
    expect(graph.getNode('gone')?.fills).toEqual([])
  })

  test('decodes data URLs as URLs, without the host', async () => {
    const encoded = fromUint8Array(PNG)
    const { graph } = await io.readDocument(
      {
        name: 'inline.pen',
        data: penBytes([
          {
            id: 'plain',
            type: 'rectangle',
            fill: { type: 'image', url: `data:image/png;base64,${encoded}` }
          },
          {
            id: 'named',
            type: 'rectangle',
            fill: { type: 'image', url: `DATA:image/png;name=a.png;base64,${encoded}` }
          },
          {
            id: 'broken',
            type: 'rectangle',
            fill: { type: 'image', url: 'data:image/png;base64,!!!' }
          }
        ])
      },
      { icons: iconProvider([], []) }
    )
    expect(graph.getNode('plain')?.fills[0]?.type).toBe('IMAGE')
    expect(graph.getNode('named')?.fills[0]?.type).toBe('IMAGE')
    expect(graph.getNode('broken')?.fills).toEqual([])
  })

  test('reads a percent-encoded image path from the file it names', async () => {
    // Pencil writes a folder named `My Design-assets` as `My%20Design-assets`.
    const asked: string[] = []
    const { graph } = await io.readDocument(
      {
        name: 'My Design.pen',
        data: penBytes([
          {
            id: 'encoded',
            type: 'rectangle',
            width: 50,
            height: 50,
            fill: { type: 'image', url: 'My%20Design-assets/red.png' }
          }
        ]),
        readAsset: async (path) => {
          asked.push(path)
          return path === 'My Design-assets/red.png' ? PNG : null
        }
      },
      { icons: iconProvider([], []) }
    )
    expect(asked).toEqual(['My Design-assets/red.png'])
    expect(graph.getNode('encoded')?.fills[0]?.type).toBe('IMAGE')
  })

  test('reads an image path that is already the file name', async () => {
    const asked: string[] = []
    const { graph } = await io.readDocument(
      {
        name: 'My Design.pen',
        data: penBytes([
          {
            id: 'plain',
            type: 'rectangle',
            width: 50,
            height: 50,
            fill: { type: 'image', url: 'My Design-assets/red.png' }
          }
        ]),
        readAsset: async (path) => {
          asked.push(path)
          return path === 'My Design-assets/red.png' ? PNG : null
        }
      },
      { icons: iconProvider([], []) }
    )
    expect(asked).toEqual(['My Design-assets/red.png'])
    expect(graph.getNode('plain')?.fills[0]?.type).toBe('IMAGE')
  })

  test('reads an image path with a malformed percent escape as written', async () => {
    const asked: string[] = []
    const { graph } = await io.readDocument(
      {
        name: 'broken.pen',
        data: penBytes([
          {
            id: 'malformed',
            type: 'rectangle',
            width: 50,
            height: 50,
            fill: { type: 'image', url: '%E0%A4%A' }
          }
        ]),
        readAsset: async (path) => {
          asked.push(path)
          return path === '%E0%A4%A' ? PNG : null
        }
      },
      { icons: iconProvider([], []) }
    )
    expect(asked).toEqual(['%E0%A4%A'])
    expect(graph.getNode('malformed')?.fills[0]?.type).toBe('IMAGE')
  })

  test('reads a file whose name contains a percent sign from its escape', async () => {
    // A URL names `file%20name.png` as `file%2520name.png`; `file%20name.png` is `file name.png`.
    const asked: string[] = []
    const { graph } = await io.readDocument(
      {
        name: 'literal.pen',
        data: penBytes([
          {
            id: 'literal',
            type: 'rectangle',
            width: 50,
            height: 50,
            fill: { type: 'image', url: 'file%2520name.png' }
          }
        ]),
        readAsset: async (path) => {
          asked.push(path)
          return path === 'file%20name.png' ? PNG : null
        }
      },
      { icons: iconProvider([], []) }
    )
    expect(asked).toEqual(['file%20name.png'])
    expect(graph.getNode('literal')?.fills[0]?.type).toBe('IMAGE')
  })

  test('does not read a percent-encoded drive or scheme', async () => {
    const asked: string[] = []
    await io.readDocument(
      {
        name: 'drive.pen',
        data: penBytes([
          {
            id: 'drive',
            type: 'rectangle',
            width: 50,
            height: 50,
            fill: { type: 'image', url: 'C%3A/secret.png' }
          }
        ]),
        readAsset: async (path) => {
          asked.push(path)
          return PNG
        }
      },
      { icons: iconProvider([], []) }
    )
    expect(asked).toEqual([])
  })

  test('does not read a percent-encoded path that leaves the document folder', async () => {
    const asked: string[] = []
    await io.readDocument(
      {
        name: 'escape.pen',
        data: penBytes([
          {
            id: 'escape',
            type: 'rectangle',
            width: 50,
            height: 50,
            fill: { type: 'image', url: '%2e%2e/secret.png' }
          }
        ]),
        readAsset: async (path) => {
          asked.push(path)
          return PNG
        }
      },
      { icons: iconProvider([], []) }
    )
    expect(asked).toEqual([])
  })
})
