import { describe, expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const component = { sessionID: 1, localID: 1 }
const label = { sessionID: 1, localID: 2 }
const alias = { sessionID: 8, localID: 2 }
const first = { sessionID: 2, localID: 1 }
const second = { sessionID: 2, localID: 2 }
const outer = { sessionID: 3, localID: 1 }
const placed = { sessionID: 4, localID: 1 }

function fixture(): NodeChange[] {
  return [
    { guid: component, type: 'SYMBOL' },
    {
      guid: label,
      overrideKey: alias,
      type: 'TEXT',
      parentIndex: { guid: component, position: '!' },
      textData: { characters: 'Default' }
    },
    { guid: outer, type: 'SYMBOL' },
    {
      guid: first,
      type: 'INSTANCE',
      parentIndex: { guid: outer, position: '!' },
      symbolData: { symbolID: component }
    },
    {
      guid: second,
      type: 'INSTANCE',
      parentIndex: { guid: outer, position: '"' },
      symbolData: { symbolID: component }
    },
    {
      guid: placed,
      type: 'INSTANCE',
      symbolData: {
        symbolID: outer,
        symbolOverrides: [
          { guidPath: { guids: [second, alias] }, textData: { characters: 'Second' } },
          { guidPath: { guids: [outer] }, opacity: 0.5 }
        ]
      }
    } as NodeChange
  ]
}

describe('instance addressing contracts', () => {
  test('targets the second occurrence through overrideKey without touching its sibling', () => {
    const result = interpretInstance(fixture(), '4:1')
    expect(result.properties.opacity).toBe(0.5)
    expect(result.children[0].children[0].properties.textData?.characters).toBe('Default')
    expect(result.children[1].children[0].properties.textData?.characters).toBe('Second')
  })

  test('occurrence payloads and subsequent interpretations share no mutable data', () => {
    const input = fixture()
    const result = interpretInstance(input, '4:1')
    const text = result.children[0].children[0].properties.textData
    if (!text) throw new Error('Expected text payload')
    text.characters = 'Mutated'
    expect(result.children[1].children[0].properties.textData?.characters).toBe('Second')
    expect(
      interpretInstance(input, '4:1').children[0].children[0].properties.textData?.characters
    ).toBe('Default')
  })

  test('does not search across nested instance boundaries for a missing path segment', () => {
    const input = fixture()
    const root = input.find((node) => node.guid === placed)
    if (!root) throw new Error('Missing root')
    root.symbolData = {
      symbolID: outer,
      symbolOverrides: [{ guidPath: { guids: [alias] }, opacity: 0 }]
    } as NodeChange['symbolData']
    expect(() => interpretInstance(input, '4:1')).toThrow('found 0')
  })

  test('rejects ambiguous overrideKey matches rather than choosing the first', () => {
    const input = fixture()
    input.push({
      guid: { sessionID: 1, localID: 3 },
      type: 'TEXT',
      overrideKey: alias,
      parentIndex: { guid: component, position: '"' }
    })
    expect(() => interpretInstance(input, '4:1')).toThrow('found 2')
  })

  test('rejects missing component sources', () => {
    expect(() =>
      interpretInstance(
        fixture().filter((node) => node.guid !== component),
        '4:1'
      )
    ).toThrow('Missing source node 1:1')
  })
})
