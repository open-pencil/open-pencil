import { describe, expect, test } from 'bun:test'

import { toUint8Array } from 'js-base64'

import {
  iconName,
  iconOptions,
  penAssets,
  parsePenDocument,
  type PenDocument,
  type PenNode
} from '@open-pencil/pen'
import type { SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { expectDefined, getNodeOrThrow } from './helpers/assert'
import { parseDocument } from './helpers/document'

// A 2 × 1 PNG.
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADElEQVR4nGP8zwACAAYIAQFazwZIAAAAAElFTkSuQmCC'

describe('penAssets', () => {
  test('lists icons with how they are drawn, images in the document folder, and data URLs', () => {
    const doc = parsePenDocument(
      JSON.stringify({
        version: '2.21',
        children: [
          { id: 'a', type: 'icon', library: 'lucide', icon: 'heart' },
          {
            id: 'b',
            type: 'icon',
            library: 'Material Symbols Rounded',
            icon: 'settings',
            weight: 300
          },
          { id: 'c', type: 'rectangle', fill: { type: 'image', url: './photo.png' } },
          { id: 'd', type: 'rectangle', fill: [{ type: 'image', url: '../secret.png' }] },
          { id: 'e', type: 'rectangle', fill: { type: 'image', url: 'https://example.com/a.png' } },
          { id: 'f', type: 'rectangle', fill: { type: 'image', url: '/etc/a.png' } },
          { id: 'g', type: 'ref', ref: 'x', descendants: { inner: { icon: 'star' } } },
          { id: 'i', type: 'icon', library: 'phosphor', icon: 'house' },
          {
            id: 'h',
            type: 'rectangle',
            fill: { type: 'image', url: `data:image/png;base64,${PNG}` }
          }
        ]
      })
    )
    expect(penAssets(doc)).toEqual({
      icons: [
        { name: 'lucide:heart' },
        { name: 'material-symbols-rounded:settings', options: { wght: 300 } },
        { name: 'ph:house' },
        { name: 'lucide:star' },
        // The override names no library or weight, so it may be any the document draws with.
        { name: 'material-symbols-rounded:star', options: { wght: 200 } },
        { name: 'material-symbols-rounded:star', options: { wght: 300 } },
        { name: 'ph:star' }
      ],
      images: ['./photo.png', `data:image/png;base64,${PNG}`]
    })
  })

  test('lists an icon whose weight variable holds no number at the default weight', () => {
    const doc = parsePenDocument(
      JSON.stringify({
        version: '2.21',
        children: [
          { id: 'a', type: 'icon', library: 'lucide', icon: 'heart', weight: '$missing' },
          {
            id: 'b',
            type: 'icon',
            library: 'Material Symbols Rounded',
            icon: 'home',
            weight: '$missing'
          }
        ]
      })
    )
    expect(penAssets(doc).icons).toEqual([
      { name: 'lucide:heart' },
      { name: 'material-symbols-rounded:home', options: { wght: 200 } }
    ])
  })

  test('lists every icon a variable names in any theme', () => {
    const doc = parsePenDocument(
      JSON.stringify({
        version: '2.21',
        themes: { mode: ['light', 'dark'] },
        variables: {
          glyph: {
            type: 'string',
            value: [{ value: 'sun' }, { value: '$night', theme: { mode: 'dark' } }]
          },
          night: { type: 'string', value: 'moon' },
          set: { type: 'string', value: 'lucide' }
        },
        children: [{ id: 'a', type: 'icon', library: '$set', icon: '$glyph' }]
      })
    )
    expect(penAssets(doc).icons).toEqual([{ name: 'lucide:sun' }, { name: 'lucide:moon' }])
  })

  test('lists the empty value a theme without an entry reads, as drawing does', () => {
    const doc = parsePenDocument(
      JSON.stringify({
        version: '2.21',
        themes: { mode: ['light', 'dark'] },
        variables: {
          thin: { type: 'number', value: [{ value: 300, theme: { mode: 'dark' } }] },
          glyph: { type: 'string', value: [{ value: 'moon', theme: { mode: 'dark' } }] }
        },
        children: [
          {
            id: 'a',
            type: 'icon',
            library: 'Material Symbols Rounded',
            icon: 'home',
            weight: '$thin'
          },
          // In the light theme the name is empty, so nothing is drawn there.
          { id: 'b', type: 'icon', library: 'lucide', icon: '$glyph' }
        ]
      })
    )
    expect(penAssets(doc).icons).toEqual([
      { name: 'material-symbols-rounded:home', options: { wght: 0 } },
      { name: 'material-symbols-rounded:home', options: { wght: 300 } },
      { name: 'lucide:moon' }
    ])
  })

  test("names each library's icons in its set, Material Symbols at their weight, 200 unless set", () => {
    expect(iconName('feather', 'star')).toBe('feather:star')
    expect(iconName('phosphor', 'airplane')).toBe('ph:airplane')
    expect(iconName('Material Symbols Outlined', 'dark_mode')).toBe(
      'material-symbols-outlined:dark_mode'
    )
    expect(iconName('unknown', 'home')).toBeNull()
    expect(iconOptions('Material Symbols Sharp', undefined)).toEqual({ wght: 200 })
    expect(iconOptions('Material Symbols Sharp', 650)).toEqual({ wght: 650 })
    expect(iconOptions('lucide', 650)).toBeUndefined()
  })
})

describe('parsePenFile — images', () => {
  function fillWith(fill: PenNode['fill'], bytes = toUint8Array(PNG)) {
    const graph = parseDocument(
      [{ id: 'shape', type: 'rectangle', width: 200, height: 100, fill }],
      {},
      { images: new Map([['./image.png', bytes]]) }
    )
    return { graph, fill: getNodeOrThrow(graph, 'shape').fills[0] }
  }

  test.each([
    [undefined, 'FILL'],
    ['cover', 'FILL'],
    ['contain', 'FIT'],
    ['stretch', 'CROP']
  ] as const)('draws mode %s as %s', (mode, expected) => {
    const { graph, fill } = fillWith({ type: 'image', url: './image.png', mode })
    expect(fill).toMatchObject({ type: 'IMAGE', imageScaleMode: expected })
    expect(graph.images.has(expectDefined(fill.imageHash))).toBe(true)
  })

  test('crops, then covers the layer with the crop', () => {
    // The right half of a 2 × 1 image is square, so on a 200 × 100 layer it is cut to its middle.
    const { fill } = fillWith({
      type: 'image',
      url: './image.png',
      transform: [2, 0, 0, 1, -1, 0]
    })
    const window = expectDefined(fill.imageTransform)
    expect(window.m00).toBeCloseTo(0.5)
    expect(window.m02).toBeCloseTo(0.5)
    expect(window.m11).toBeCloseTo(0.5)
    expect(window.m12).toBeCloseTo(0.25)
  })

  test('crops an image whose header declares no pixels without fitting it', () => {
    const empty = toUint8Array(PNG)
    // The IHDR width, which follows the signature, the chunk length, and the chunk type.
    empty.set([0, 0, 0, 0], 16)
    const { fill } = fillWith(
      { type: 'image', url: './image.png', transform: [2, 0, 0, 1, -1, 0] },
      empty
    )
    const window = expectDefined(fill.imageTransform)
    expect(Object.values(window).every(Number.isFinite)).toBe(true)
  })

  test('reads image files the host loaded, and skips the ones it did not', () => {
    const graph = parseDocument(
      [
        {
          id: 'loaded',
          type: 'rectangle',
          fill: [{ type: 'image', url: './a.png', opacity: 0.5 }]
        },
        { id: 'missing', type: 'rectangle', fill: [{ type: 'image', url: './b.png' }, '#FF0000'] }
      ],
      {},
      { images: new Map([['./a.png', toUint8Array(PNG)]]) }
    )
    expect(getNodeOrThrow(graph, 'missing').fills.map((fill) => fill.type)).toEqual(['SOLID'])
    expect(getNodeOrThrow(graph, 'loaded').fills[0]).toMatchObject({ type: 'IMAGE', opacity: 0.5 })
  })
})

describe('parsePenFile — icons', () => {
  function drawn(fields: Partial<PenNode>, doc: Partial<PenDocument> = {}) {
    const calls: { name: string; size: number; color: Color; options?: Record<string, number> }[] =
      []
    const icons = {
      draw(
        graph: SceneGraph,
        frameId: string,
        name: string,
        size: number,
        color: Color,
        options?: Record<string, number>
      ) {
        calls.push(options ? { name, size, color, options } : { name, size, color })
        graph.createNode('VECTOR', frameId, { width: size, height: size })
        return true
      }
    }
    const graph = parseDocument(
      [
        {
          id: 'icon',
          type: 'icon',
          library: 'lucide',
          icon: 'heart',
          width: 96,
          height: 30,
          fill: '#CC0000',
          ...fields
        }
      ],
      doc,
      { icons }
    )
    return { graph, calls, icon: getNodeOrThrow(graph, 'icon') }
  }

  test('draws the glyph in the fill colour, fitted and centred in the box', () => {
    const { graph, calls, icon } = drawn({})
    expect(calls).toEqual([{ name: 'lucide:heart', size: 30, color: { r: 0.8, g: 0, b: 0, a: 1 } }])
    expect(icon.fills).toEqual([])
    expect(graph.getChildren('icon').map((glyph) => [glyph.x, glyph.y])).toEqual([[33, 0]])
  })

  test('draws a Material Symbol from its set at the icon weight, 200 by default', () => {
    // A variable that holds no weight leaves the default.
    for (const [weight, expected] of [
      [undefined, 200],
      [650, 650],
      ['$missing', 200]
    ] as const) {
      const { calls } = drawn({ library: 'Material Symbols Rounded', icon: 'home', weight })
      expect(calls).toEqual([
        {
          name: 'material-symbols-rounded:home',
          size: 30,
          color: { r: 0.8, g: 0, b: 0, a: 1 },
          options: { wght: expected }
        }
      ])
    }
  })

  test('reads the library and icon from variables in the layer theme', () => {
    const { calls } = drawn(
      { library: '$set', icon: '$glyph', theme: { mode: 'dark' } },
      {
        themes: { mode: ['light', 'dark'] },
        variables: {
          set: { type: 'string', value: 'feather' },
          glyph: {
            type: 'string',
            value: [{ value: 'sun' }, { value: 'moon', theme: { mode: 'dark' } }]
          }
        }
      }
    )
    expect(calls.map((call) => call.name)).toEqual(['feather:moon'])
  })

  test('draws at the weight a theme without an entry reads, which the assets list', () => {
    const { calls } = drawn(
      { library: 'Material Symbols Rounded', icon: 'home', weight: '$thin' },
      {
        themes: { mode: ['light', 'dark'] },
        variables: { thin: { type: 'number', value: [{ value: 300, theme: { mode: 'dark' } }] } }
      }
    )
    expect(calls.map((call) => call.options)).toEqual([{ wght: 0 }])
  })
})
