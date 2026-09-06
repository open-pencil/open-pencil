import { describe, expect, test } from 'bun:test'

import { parsePenFile, type PenDocument, type PenNode } from '@open-pencil/pen'

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
  const plainId = plain?.boundVariables['fills[0]']
  const dashedId = dashed?.boundVariables['fills[0]']

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
      const variable = [...graph.variables.values()].find(
        (candidate) => candidate.name === `${prefix}merk-blauw`
      )

      expect(variable).toBeDefined()
      expect(node?.fills).toEqual(graph.getNode('literal')?.fills)
      expect(node?.fills[0]?.color).toEqual(BLUE)
      expect(node?.strokes[0]?.color).toEqual(BLUE)
      expect(node?.boundVariables).toEqual({
        'fills[0]': variable?.id,
        'strokes[0]': variable?.id
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
