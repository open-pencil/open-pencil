import { describe, expect, test } from 'bun:test'

import { fractionalPosition, orderKeyBetween, siblingOrderKeys } from '@open-pencil/fig/node-change'
import { SceneGraph } from '@open-pencil/scene-graph'

import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'

import { expectDefined } from '#tests/helpers/assert'

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
      const key = expectDefined(orderKeyBetween(lo, hi), `key between ${lo} and ${hi}`)
      if (lo !== null) expect(key > lo).toBe(true)
      if (hi !== null) expect(key < hi).toBe(true)
    }
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

  test('re-keys imported siblings that were moved out of order', () => {
    const keys = siblingOrderKeys(['#', '!', '"'])
    expect(keys[0]).toBe('#')
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
