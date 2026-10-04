import { describe, expect, test } from 'bun:test'

import {
  fractionalPosition,
  orderKeyBetween,
  sceneNodeToKiwi,
  siblingOrderKeys
} from '@open-pencil/fig/node-change'
import { SceneGraph } from '@open-pencil/scene-graph'

function requireKey(key: string | null, label: string): string {
  if (key === null) throw new Error(`expected a key ${label}`)
  return key
}

function expectStrictlyIncreasing(keys: string[]) {
  for (let i = 1; i < keys.length; i++) expect(keys[i] > keys[i - 1]).toBe(true)
}

describe('orderKeyBetween', () => {
  test('returns a key strictly between its bounds', () => {
    for (const [lo, hi] of [
      [null, '#'],
      ['!', '"'],
      ['~', null],
      ['a', 'b'],
      [null, null]
    ] as const) {
      const key = requireKey(orderKeyBetween(lo, hi), `between ${lo} and ${hi}`)
      if (lo !== null) expect(key > lo).toBe(true)
      if (hi !== null) expect(key < hi).toBe(true)
    }
  })

  test('stops at a longer prefix of hi when no character can be lowered', () => {
    expect(orderKeyBetween('a', 'a!!')).toBe('a!')
    expect(orderKeyBetween(null, '!!')).toBe('!')
    expect(orderKeyBetween('a', 'a!')).toBeNull()
  })

  test('keeps keys short when many keys are appended one after another', () => {
    let lo = '$'
    for (let n = 0; n < 500; n++) {
      const key = requireKey(orderKeyBetween(lo, null), 'after ' + lo)
      expect(key > lo).toBe(true)
      lo = key
    }
    expect(lo.length).toBeLessThan(100)
  })

  test('returns null when nothing sorts before the smallest key', () => {
    expect(orderKeyBetween(null, '!')).toBeNull()
  })
})

describe('siblingOrderKeys', () => {
  test('keeps index keys when no sibling has an imported key', () => {
    expect(siblingOrderKeys([undefined, undefined, undefined])).toEqual([
      fractionalPosition(0),
      fractionalPosition(1),
      fractionalPosition(2)
    ])
  })

  test('keeps imported keys that are still in order', () => {
    const keys = siblingOrderKeys(['!', '#', '%', undefined])
    expect(keys.slice(0, 3)).toEqual(['!', '#', '%'])
    expectStrictlyIncreasing(keys)
  })

  test('gives a layer inserted before imported siblings a key of its own', () => {
    const keys = siblingOrderKeys([undefined, '!', '"', '#'])
    expect(new Set(keys).size).toBe(4)
    expectStrictlyIncreasing(keys)
  })

  test('gives a layer inserted between imported siblings a key between them', () => {
    const keys = siblingOrderKeys(['!', undefined, '"'])
    expect(keys[0]).toBe('!')
    expect(keys[2]).toBe('"')
    expectStrictlyIncreasing(keys)
  })

  test('re-keys only the sibling that was moved out of order', () => {
    const keys = siblingOrderKeys(['$', '!O', '"', '#'])
    expect(keys.slice(1)).toEqual(['!O', '"', '#'])
    expectStrictlyIncreasing(keys)
  })

  test('does not anchor on the lowest key when a sibling has to precede it', () => {
    const keys = siblingOrderKeys(['"', '!', '#'])
    expect(keys[0]).toBe('"')
    expect(keys[2]).toBe('#')
    expectStrictlyIncreasing(keys)
  })

  test('keeps the siblings a moved layer jumped over', () => {
    const keys = siblingOrderKeys([null, '~', '!O', '"', '#'])
    expect(keys.slice(2)).toEqual(['!O', '"', '#'])
    expect(new Set(keys).size).toBe(keys.length)
    expectStrictlyIncreasing(keys)
  })
})

describe('Figma keys containing spaces', () => {
  // Real Figma files use keys such as '&RQTOt7CO O'; the space sorts below the printable range.
  test('finds a key between a key and its space-extended successor', () => {
    const key = requireKey(orderKeyBetween('&RQTOt7CO', '&RQTOt7CO O'), 'before the space key')
    expect(key > '&RQTOt7CO' && key < '&RQTOt7CO O').toBe(true)
  })

  test('keeps space-bearing imported keys and fits new layers between them', () => {
    const keys = siblingOrderKeys(['&RQTOt7CO', null, '&RQTOt7CO O', '&RQTOt7CO f', null])
    expect(keys[0]).toBe('&RQTOt7CO')
    expect(keys[2]).toBe('&RQTOt7CO O')
    expect(keys[3]).toBe('&RQTOt7CO f')
    expect(new Set(keys).size).toBe(keys.length)
    expectStrictlyIncreasing(keys)
  })
})

describe('Figma export order keys', () => {
  test('a layer added before imported siblings does not share their keys', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { name: 'Frame' })
    for (const [name, orderKey] of [
      ['A', '!'],
      ['B', '"'],
      ['C', '#']
    ]) {
      const child = graph.createNode('RECTANGLE', frame.id, { name })
      child.source.orderKey = orderKey
    }
    const inserted = graph.createNode('RECTANGLE', frame.id, { name: 'Inserted' })
    frame.childIds = [inserted.id, ...frame.childIds.filter((id) => id !== inserted.id)]

    const changes = sceneNodeToKiwi(frame, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    const children = changes.slice(1)
    const positions = children.map((change) => change.parentIndex?.position ?? '')

    expect(children.map((change) => change.name)).toEqual(['Inserted', 'A', 'B', 'C'])
    // Nothing sorts before '!', so A is re-keyed; B and C keep their imported keys.
    expect(positions.slice(2)).toEqual(['"', '#'])
    expect(new Set(positions).size).toBe(4)
    expectStrictlyIncreasing(positions)
  })
})
