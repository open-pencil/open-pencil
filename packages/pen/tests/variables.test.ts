import { describe, expect, test } from 'bun:test'

import { parsePenFile, type PenDocument, type PenNode } from '@open-pencil/pen'

import { expectDefined } from './helpers/assert'

const BLUE = { r: 64 / 255, g: 148 / 255, b: 208 / 255, a: 1 }

function parseVariableDocument(prefix: string, children: PenNode[]) {
  const document: PenDocument = {
    version: '2.14',
    variables: {
      [`${prefix}merk-blauw`]: { type: 'color', value: '#4094D0' },
      [`${prefix}font-tekst`]: { type: 'string', value: 'Barlow' },
      [`${prefix}spacing`]: { type: 'number', value: 24 },
      [`${prefix}size`]: { type: 'number', value: 240 }
    },
    children
  }
  return parsePenFile(JSON.stringify(document))
}

test('keeps plain and double-dash variable names distinct in one document', () => {
  const document: PenDocument = {
    version: '2.14',
    variables: {
      blue: { type: 'color', value: '#4094D0' },
      '--blue': { type: 'color', value: '#FFFFFF' }
    },
    children: [
      { id: 'plain', type: 'frame', fill: '$blue' },
      { id: 'dashed', type: 'frame', fill: '$--blue' }
    ]
  }
  const graph = parsePenFile(JSON.stringify(document))
  const plain = graph.getNode('plain')
  const dashed = graph.getNode('dashed')
  const plainId = plain?.boundVariables['fills/0/color']
  const dashedId = dashed?.boundVariables['fills/0/color']

  expect(plain?.fills[0]?.color).toEqual(BLUE)
  expect(dashed?.fills[0]?.color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
  expect(plainId).toBeDefined()
  expect(dashedId).toBeDefined()
  expect(plainId).not.toBe(dashedId)
  expect(graph.variables.get(plainId ?? '')?.name).toBe('blue')
  expect(graph.variables.get(dashedId ?? '')?.name).toBe('--blue')
})

describe.each(['', '--'])('parsePenFile — $%sname references (#563)', (prefix) => {
  const colorRef = `$${prefix}merk-blauw`
  const fontRef = `$${prefix}font-tekst`
  const spacingRef = `$${prefix}spacing`
  const sizeRef = `$${prefix}size`

  test.each([
    ['string', colorRef],
    ['object', { type: 'color', color: colorRef }],
    ['array', [{ type: 'color', color: colorRef }]]
  ] satisfies [string, PenNode['fill']][])(
    'resolves %s fills and preserves color bindings',
    (_name, fill) => {
      const graph = parseVariableDocument(prefix, [
        { id: 'literal', type: 'frame', fill: '#4094D0', width: 240, height: 120 },
        {
          id: 'bound',
          type: 'frame',
          fill,
          stroke: { align: 'inside', thickness: 2, fill: colorRef },
          width: 240,
          height: 120
        }
      ])
      const node = graph.getNode('bound')
      const variable = expectDefined(
        [...graph.variables.values()].find((candidate) => candidate.name === `${prefix}merk-blauw`),
        'brand colour variable'
      )

      expect(variable).toBeDefined()
      expect(node?.fills).toEqual(graph.getNode('literal')?.fills)
      expect(node?.fills[0]?.color).toEqual(BLUE)
      expect(node?.strokes[0]?.color).toEqual(BLUE)
      expect(node?.boundVariables).toEqual({
        'fills/0/color': variable.id,
        'strokes/0/color': variable.id
      })
      expect(graph.getNode('literal')?.boundVariables).toEqual({})
    }
  )

  test('resolves and binds font families without expanding text content', () => {
    const graph = parseVariableDocument(prefix, [
      { id: 'literal', type: 'text', content: colorRef, fontFamily: 'Barlow' },
      { id: 'bound', type: 'text', content: colorRef, fontFamily: fontRef }
    ])
    const node = graph.getNode('bound')
    const fontId = node?.boundVariables.fontFamily

    expect(node?.fontFamily).toBe('Barlow')
    expect(node?.fontFamily).toBe(graph.getNode('literal')?.fontFamily)
    expect(node?.text).toBe(colorRef)
    expect(fontId).toBeDefined()
    expect(graph.variables.get(fontId ?? '')?.name).toBe(`${prefix}font-tekst`)
    expect(graph.getNode('literal')?.boundVariables).toEqual({})
  })

  test('resolves numeric references in sizing, spacing, padding, and corners', () => {
    const graph = parseVariableDocument(prefix, [
      {
        id: 'frame',
        type: 'frame',
        layout: 'horizontal',
        width: sizeRef,
        height: sizeRef,
        gap: spacingRef,
        padding: spacingRef,
        cornerRadius: spacingRef
      }
    ])

    expect(graph.getNode('frame')).toMatchObject({
      width: 240,
      height: 240,
      itemSpacing: 24,
      paddingTop: 24,
      paddingRight: 24,
      paddingBottom: 24,
      paddingLeft: 24,
      cornerRadius: 24
    })
  })

  test('uses existing fallbacks without binding unknown variables', () => {
    const unknown = `$${prefix}unknown`
    const graph = parseVariableDocument(prefix, [
      { id: 'frame', type: 'frame', fill: unknown, width: unknown },
      { id: 'text', type: 'text', fontFamily: unknown }
    ])

    expect(graph.getNode('frame')).toMatchObject({
      fills: [{ color: { r: 0, g: 0, b: 0, a: 1 } }],
      width: 0,
      boundVariables: {}
    })
    expect(graph.getNode('text')).toMatchObject({ fontFamily: '', boundVariables: {} })
  })
})

// Measured on pen.dev 2.21 with two theme axes.
describe('parsePenFile — themes', () => {
  const themes = { mode: ['light', 'dark'], density: ['compact', 'cozy'] }
  const variables: PenDocument['variables'] = {
    accent: {
      type: 'color',
      value: [
        { value: '#CC0000', theme: { mode: 'light', density: 'compact' } },
        { value: '#00CC00', theme: { mode: 'dark' } },
        { value: '#0000CC', theme: { mode: 'light', density: 'cozy' } }
      ]
    },
    alias: { type: 'color', value: '$accent' },
    gap: {
      type: 'number',
      value: [
        { value: 4, theme: { density: 'compact' } },
        { value: 16, theme: { density: 'cozy' } }
      ]
    },
    shown: {
      type: 'boolean',
      value: [
        { value: true, theme: { mode: 'light' } },
        { value: false, theme: { mode: 'dark' } }
      ]
    },
    darkOnly: { type: 'number', value: [{ value: 10, theme: { mode: 'dark' } }] }
  }

  function swatches(theme?: Record<string, string>, inner?: Record<string, string>) {
    const graph = parsePenFile(
      JSON.stringify({
        version: '2.21',
        themes,
        variables,
        children: [
          {
            id: 'outer',
            type: 'frame',
            layout: 'vertical',
            gap: '$darkOnly',
            ...(theme ? { theme } : {}),
            children: [
              {
                id: 'inner',
                type: 'frame',
                layout: 'vertical',
                gap: '$gap',
                ...(inner ? { theme: inner } : {}),
                children: [
                  { id: 'accent', type: 'rectangle', width: 10, height: 10, fill: '$accent' },
                  { id: 'alias', type: 'rectangle', width: 10, height: 10, fill: '$alias' },
                  { id: 'shown', type: 'rectangle', width: 10, height: 10, enabled: '$shown' }
                ]
              }
            ]
          }
        ]
      })
    )
    const node = (id: string) => expectDefined(graph.getNode(id), id)
    return {
      graph,
      accent: node('accent').fills[0]?.color,
      alias: node('alias').fills[0]?.color,
      shown: node('shown').visible,
      gap: node('inner').itemSpacing,
      outerGap: node('outer').itemSpacing
    }
  }

  test('puts every combination of axis values in one collection', () => {
    const { graph } = swatches()
    const collection = expectDefined([...graph.variableCollections.values()][0], 'collection')
    expect(collection.modes.map((mode) => mode.name)).toEqual([
      'light / compact',
      'light / cozy',
      'dark / compact',
      'dark / cozy'
    ])
  })

  test('reads an unthemed layer in the first value of each axis', () => {
    expect(swatches()).toMatchObject({
      accent: { r: 0.8, g: 0, b: 0 },
      gap: 4,
      shown: true,
      outerGap: 0
    })
  })

  test('resolves aliases in the layer theme', () => {
    const { accent, alias } = swatches({ mode: 'dark' })
    expect(alias).toEqual(accent)
    expect(accent).toMatchObject({ r: 0, g: 0.8, b: 0 })
  })

  test('merges a nested theme over its parent, axis by axis', () => {
    expect(swatches({ mode: 'dark' }, { density: 'cozy' })).toMatchObject({
      accent: { r: 0, g: 0.8, b: 0 },
      gap: 16,
      shown: false,
      outerGap: 10
    })
  })

  test('gives themed layers their mode, which their children inherit', () => {
    const { graph } = swatches({ mode: 'dark' }, { density: 'cozy' })
    const collection = expectDefined([...graph.variableCollections.values()][0], 'collection')
    const id = collection.id
    const modeName = (nodeId: string) =>
      collection.modes.find((mode) => mode.modeId === graph.getNode(nodeId)?.variableModes[id])
        ?.name
    expect(modeName('outer')).toBe('dark / compact')
    expect(modeName('inner')).toBe('dark / cozy')
    expect(graph.getNode('accent')?.variableModes[id]).toBeUndefined()
  })
})
