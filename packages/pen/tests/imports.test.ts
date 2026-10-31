import { describe, expect, test } from 'bun:test'

import { importedDocument, type PenDocument, type PenNode } from '@open-pencil/pen'

import { getNodeOrThrow } from './helpers/assert'
import { parseDocument } from './helpers/document'

const BLUE = { r: 0, g: 0, b: 1, a: 1 }

const library: PenDocument = {
  version: '2.21',
  variables: {
    'color-primary': { type: 'color', value: '#0000FF' },
    'color-action': { type: 'color', value: '$color-primary' }
  },
  children: [
    {
      id: 'button',
      type: 'frame',
      reusable: true,
      fill: '$color-action',
      children: [
        { id: 'label', type: 'text', content: '$12.00', fill: '$color-primary' },
        { id: 'icon', type: 'ref', ref: 'glyph', descendants: { dot: { fill: '$color-primary' } } }
      ]
    },
    {
      id: 'glyph',
      type: 'frame',
      reusable: true,
      children: [{ id: 'dot', type: 'ellipse', width: 4, height: 4 }]
    }
  ]
}

const libraryWith = (child: PenNode): PenDocument => ({ version: '2.21', children: [child] })

describe('importedDocument', () => {
  test('names layers, references, override paths, and variables under the alias', () => {
    const doc = importedDocument('ui', library, new Map())
    expect(Object.keys(doc.variables ?? {})).toEqual(['ui:color-primary', 'ui:color-action'])
    expect(doc.variables?.['ui:color-action']?.value).toBe('$ui:color-primary')
    const [button] = doc.children
    expect(button).toMatchObject({ id: 'ui:button', fill: '$ui:color-action' })
    expect(button.children?.[0]).toMatchObject({ id: 'ui:label', fill: '$ui:color-primary' })
    expect(button.children?.[1]).toMatchObject({
      id: 'ui:icon',
      ref: 'ui:glyph',
      descendants: { 'ui:dot': { fill: '$ui:color-primary' } }
    })
  })

  test('keeps text that only looks like a variable', () => {
    const doc = importedDocument('ui', library, new Map())
    expect(doc.children[0]?.children?.[0]?.content).toBe('$12.00')
  })

  test('renames each step of an override path and the layers an override puts in', () => {
    const doc = importedDocument(
      'ui',
      libraryWith({
        id: 'card',
        type: 'ref',
        ref: 'panel',
        descendants: {
          'row/cell': { type: 'ref', id: 'swap', ref: 'other' },
          body: { children: [{ id: 'inner', type: 'text', content: 'Hi' }] }
        }
      }),
      new Map()
    )
    expect(doc.children[0]?.descendants).toEqual({
      'ui:row/ui:cell': { type: 'ref', id: 'ui:swap', ref: 'ui:other' },
      'ui:body': { children: [{ id: 'ui:inner', type: 'text', content: 'Hi' }] }
    })
  })

  test('reads the documents an import imports into it, named through both aliases', () => {
    const nested = importedDocument('base', library, new Map())
    const doc = importedDocument(
      'ui',
      libraryWith({ id: 'cta', type: 'ref', ref: 'base:button', reusable: true }),
      new Map([['base', nested]])
    )
    expect(doc.imports).toBeUndefined()
    expect(doc.children.map((node) => node.id)).toEqual([
      'ui:cta',
      'ui:base:button',
      'ui:base:glyph'
    ])
    expect(doc.children[0]?.ref).toBe('ui:base:button')
    expect(Object.keys(doc.variables ?? {})).toContain('ui:base:color-primary')
  })
})

describe('buildPenGraph with imports', () => {
  const imports = new Map([['ui', importedDocument('ui', library, new Map())]])
  const read = () =>
    parseDocument(
      [
        {
          id: 'screen',
          type: 'frame',
          fill: '$ui:color-primary',
          children: [
            {
              id: 'cta',
              type: 'ref',
              ref: 'ui:button',
              descendants: { 'ui:label': { content: 'Pay' } }
            }
          ]
        }
      ],
      { imports: { ui: '../library/ui.lib.pen' } },
      { imports }
    )

  test('draws instances of imported components, with their overrides', () => {
    const graph = read()
    const cta = getNodeOrThrow(graph, 'cta')
    expect(cta.type).toBe('INSTANCE')
    expect(cta.componentId).toBe('ui:button')
    const label = graph.getChildren(cta.id).find((node) => node.type === 'TEXT')
    expect(label?.text).toBe('Pay')
  })

  test('resolves imported variables, through their aliases', () => {
    const graph = read()
    expect(getNodeOrThrow(graph, 'screen').fills[0]?.color).toEqual(BLUE)
    expect(getNodeOrThrow(graph, 'cta').fills[0]?.color).toEqual(BLUE)
  })

  test('puts imported layers on a page of their own, after the document', () => {
    const graph = read()
    const pages = graph.getPages()
    expect(pages.map((page) => page.name)).toEqual(['Page 1', 'ui'])
    expect(graph.getChildren(pages[1]?.id ?? '').map((node) => node.id)).toEqual([
      'ui:button',
      'ui:glyph'
    ])
  })
})
