import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { toUint8Array } from 'js-base64'

import { IORegistry, penFormat } from '@open-pencil/core/io'

const io = new IORegistry([penFormat])

const BLUE = { r: 0, g: 0, b: 1, a: 1 }

// A 2 × 1 PNG and a 1 × 1 PNG.
const WIDE_PNG = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADElEQVR4nGP8zwACAAYIAQFazwZIAAAAAElFTkSuQmCC'
)
const DOT_PNG = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
)

function penBytes(fields: Record<string, unknown>) {
  return new TextEncoder().encode(JSON.stringify({ version: '2.21', ...fields }))
}

/** A host holding `files` by their path relative to the document, recording what it is asked. */
function host(files: Partial<Record<string, Record<string, unknown>>>, asked: string[]) {
  return async (path: string) => {
    asked.push(path)
    const file = files[path]
    return file ? penBytes(file) : null
  }
}

const screen = {
  imports: { ui: '../library/ui.lib.pen' },
  children: [
    {
      id: 'screen',
      type: 'frame',
      fill: '$ui:color-primary',
      children: [{ id: 'cta', type: 'ref', ref: 'ui:button' }]
    }
  ]
}

describe('penFormat.readDocument — imports', () => {
  test('reads imports through the host, by their path from the document', async () => {
    const asked: string[] = []
    const { graph } = await io.readDocument({
      name: 'screens/checkout.pen',
      data: penBytes(screen),
      readImport: host(
        {
          '../library/ui.lib.pen': {
            imports: { base: './base.lib.pen' },
            children: [
              {
                id: 'button',
                type: 'frame',
                reusable: true,
                children: [{ id: 'face', type: 'ref', ref: 'base:pill' }]
              }
            ]
          },
          '../library/base.lib.pen': {
            variables: { 'color-primary': { type: 'color', value: '#0000FF' } },
            children: [
              { id: 'pill', type: 'frame', reusable: true, fill: '$color-primary', width: 40 }
            ]
          }
        },
        asked
      )
    })
    expect([...asked].sort()).toEqual(['../library/base.lib.pen', '../library/ui.lib.pen'])
    const cta = getNodeOrThrow(graph, 'cta')
    expect(cta.componentId).toBe('ui:button')
    const [face] = graph.getChildren(cta.id)
    expect(face.fills[0]?.color).toEqual(BLUE)
  })

  test('leaves out an import that imports itself through others', async () => {
    const asked: string[] = []
    const { graph } = await io.readDocument({
      name: 'checkout.pen',
      data: penBytes(screen),
      readImport: host(
        {
          '../library/ui.lib.pen': {
            imports: { again: './ui.lib.pen' },
            variables: { 'color-primary': { type: 'color', value: '#0000FF' } },
            children: [{ id: 'button', type: 'frame', reusable: true }]
          }
        },
        asked
      )
    })
    expect(asked).toEqual(['../library/ui.lib.pen'])
    expect(getNodeOrThrow(graph, 'screen').fills[0]?.color).toEqual(BLUE)
  })

  test('reads a document whose imports the host cannot read', async () => {
    const { graph } = await io.readDocument({
      name: 'checkout.pen',
      data: penBytes(screen),
      readImport: () => Promise.resolve(null)
    })
    expect(graph.getNode('screen')).toBeDefined()
    expect(graph.getPages().map((page) => page.name)).toEqual(['Page 1'])
  })
})

describe('penFormat.readDocument — imports, malformed and with images', () => {
  test('leaves out an import that is no .pen document', async () => {
    const { graph } = await io.readDocument({
      name: 'checkout.pen',
      data: penBytes(screen),
      readImport: () => Promise.resolve(new TextEncoder().encode('not a document'))
    })
    expect(graph.getNode('screen')).toBeDefined()
    expect(graph.getPages().map((page) => page.name)).toEqual(['Page 1'])
  })

  const logo = (id: string) => ({
    id,
    type: 'rectangle',
    reusable: true,
    width: 20,
    height: 10,
    fill: { type: 'image', url: 'img/logo.png' }
  })

  /** A document and a library beside it in `../library/`, each naming `img/logo.png`. */
  async function readWithLibraryImage(asked: { asset: string[]; import: string[] }) {
    return io.readDocument({
      name: 'checkout.pen',
      data: penBytes({
        imports: { ui: '../library/ui.lib.pen' },
        children: [logo('own'), { id: 'cta', type: 'ref', ref: 'ui:logo' }]
      }),
      readAsset: async (path) => {
        asked.asset.push(path)
        return path === 'img/logo.png' ? WIDE_PNG : null
      },
      readImport: async (path) => {
        asked.import.push(path)
        if (path === '../library/ui.lib.pen') return penBytes({ children: [logo('logo')] })
        return path === '../library/img/logo.png' ? DOT_PNG : null
      }
    })
  }

  test('reads an imported document’s images beside it, through the import reader', async () => {
    const asked = { asset: [] as string[], import: [] as string[] }
    const { graph } = await readWithLibraryImage(asked)
    expect(asked.asset).toEqual(['img/logo.png'])
    expect([...asked.import].sort()).toEqual(['../library/img/logo.png', '../library/ui.lib.pen'])
    expect(getNodeOrThrow(graph, 'cta').fills[0]?.type).toBe('IMAGE')
  })

  test('keeps apart a document’s image and an imported one with the same name', async () => {
    const { graph } = await readWithLibraryImage({ asset: [], import: [] })
    const own = getNodeOrThrow(graph, 'own').fills[0]?.imageHash
    const imported = getNodeOrThrow(graph, 'cta').fills[0]?.imageHash
    expect(own).toBeDefined()
    expect(imported).toBeDefined()
    expect(imported).not.toBe(own)
    expect(graph.images.get(imported ?? '')).toEqual(DOT_PNG)
  })

  test('never asks the asset reader for a file outside the document’s folder', async () => {
    const asked: string[] = []
    await io.readDocument({
      name: 'checkout.pen',
      data: penBytes({
        children: [
          { id: 'up', type: 'rectangle', fill: { type: 'image', url: '../library/img/logo.png' } }
        ]
      }),
      readAsset: async (path) => {
        asked.push(path)
        return WIDE_PNG
      },
      readImport: async (path) => {
        asked.push(path)
        return WIDE_PNG
      }
    })
    expect(asked).toEqual([])
  })
})
