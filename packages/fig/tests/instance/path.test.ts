import { describe, expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import fixture from './fixtures/accordion-instance-paths.json'

// Reduced from shadcn Figma kit (Community), Accordion 7:283.
// Figma oracle: second/third text occurrences use source 4:483, but read
// "Is it styled?" / "Is it animated?". First item selects component 7:251.
const changes = fixture as NodeChange[]

function descendants(node: ReturnType<typeof interpretInstance>): (typeof node)[] {
  return [node, ...node.children.flatMap(descendants)]
}

describe('instance-path interpretation', () => {
  test('preserves repeated source occurrences, nested text and outer typography', () => {
    const before = structuredClone(changes)
    const result = interpretInstance(changes, '7:283')
    expect(result.mainComponentId).toBe('7:186')
    expect(result.children.map((node) => node.sourceId)).toEqual(['7:163', '7:169', '7:175'])
    expect(result.children.map((node) => node.mainComponentId)).toEqual(['7:251', '7:156', '7:156'])
    const second = descendants(result.children[1]).find((node) => node.sourceId === '4:483')
    const third = descendants(result.children[2]).find((node) => node.sourceId === '4:483')
    expect(second?.properties.textData?.characters).toBe('Is it styled?')
    expect(third?.properties.textData?.characters).toBe('Is it animated?')
    expect(second?.properties.fontSize).toBe(16)
    expect(third?.properties.fontSize).toBe(16)
    // Expansion retains occurrence bounds. Figma's 92px final height is a
    // subsequent Hug-layout result, not the structural swap operation.
    expect(result.children[0].properties.size).toEqual({ x: 440, y: 56 })
    expect(result.children[0].properties.name).toBe('AccordionItem')
    expect(second).not.toBe(third)
    expect(descendants(result.children[0]).some((node) => node.sourceId === '7:254')).toBe(true)
    expect(changes).toEqual(before)
  })

  test('does not depend on archive declaration order', () => {
    expect(interpretInstance([...changes].reverse(), '7:283')).toEqual(
      interpretInstance(changes, '7:283')
    )
  })

  test('rejects cyclic component expansion', () => {
    expect(() =>
      interpretInstance(
        [
          {
            guid: { sessionID: 1, localID: 1 },
            type: 'INSTANCE',
            symbolData: { symbolID: { sessionID: 1, localID: 1 } }
          }
        ],
        '1:1'
      )
    ).toThrow('Cyclic component expansion')
  })
})
