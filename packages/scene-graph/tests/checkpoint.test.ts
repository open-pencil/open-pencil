import { describe, expect, test } from 'bun:test'

import { captureGraphCheckpoint } from '#scene-graph/checkpoint'
import { equalInstanceIndexes } from '#scene-graph/checkpoint/index-equality'
import { SceneGraph } from '#scene-graph/graph'
import { isEqual } from 'es-toolkit'

function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const first = graph.createNode('RECTANGLE', page.id)
  const second = graph.createNode('RECTANGLE', page.id)
  return { graph, first, second }
}

describe('graph checkpoints', () => {
  test('exposes independent mutable snapshot Maps and preserves surviving roots', () => {
    const { graph, first } = setup()
    const checkpoint = captureGraphCheckpoint(graph)
    const next = captureGraphCheckpoint(graph)
    expect(checkpoint.nodes).toBeInstanceOf(Map)
    expect(checkpoint.variables).toBeInstanceOf(Map)
    const saved = checkpoint.nodes.get(first.id)
    if (!saved) throw new Error('Missing saved node')
    saved.opacity = 0.75
    expect(first.opacity).toBe(1)
    checkpoint.restore()
    expect(first.opacity).toBe(0.75)
    expect(graph.getNode(first.id)).toBe(first)
    next.restore()
    expect(first.opacity).toBe(1)
  })

  test('allows reentrant capture only after the entire graph is restored', () => {
    const { graph, first, second } = setup()
    const checkpoint = captureGraphCheckpoint(graph)
    first.opacity = 0.1
    second.opacity = 0.2
    let nested = false
    const unsubscribe = graph.onNodeEvents({
      updated: () => {
        if (nested) return
        nested = true
        expect(first.opacity).toBe(1)
        expect(second.opacity).toBe(1)
        const inner = captureGraphCheckpoint(graph)
        second.opacity = 0.25
        inner.assertPropertiesOnly()
        expect(inner.nodes.get(second.id)?.opacity).toBe(1)
      }
    })
    try {
      checkpoint.restore()
    } finally {
      unsubscribe()
    }
    expect(nested).toBe(true)
    expect(graph.getNode(first.id)).toBe(first)
    expect(second.opacity).toBe(0.25)
    const next = captureGraphCheckpoint(graph)
    second.opacity = 0.5
    next.restore()
    expect(second.opacity).toBe(0.25)
  })

  test('new captures work after a recovery notification throws', () => {
    const { graph, first } = setup()
    const checkpoint = captureGraphCheckpoint(graph)
    first.opacity = 0.25
    const unsubscribe = graph.onNodeEvents({
      updated: () => {
        throw new Error('Listener failure')
      }
    })
    try {
      expect(() => checkpoint.restore()).toThrow('Listener failure')
    } finally {
      unsubscribe()
    }
    const next = captureGraphCheckpoint(graph)
    first.opacity = 0.5
    next.restore()
    expect(first.opacity).toBe(1)
  })

  test('does not reflect graph Proxies before native capture', () => {
    const { graph, first } = setup()
    let capturing = true
    const proxy = new Proxy(graph, {
      ownKeys: () => {
        throw new Error('Unexpected graph inspection')
      },
      getOwnPropertyDescriptor: (target, key) => {
        if (capturing) throw new Error('Unexpected graph inspection')
        return Reflect.getOwnPropertyDescriptor(target, key)
      }
    })
    const checkpoint = captureGraphCheckpoint(proxy)
    capturing = false
    first.opacity = 0.5
    checkpoint.restore()
    expect(first.opacity).toBe(1)
  })

  test('checks changed image references before later document metadata', () => {
    const { graph } = setup()
    graph.images.set('image', new Uint8Array([1]))
    const checkpoint = captureGraphCheckpoint(graph)
    graph.images.set('image', new Uint8Array([2]))
    Object.defineProperty(graph, 'rootId', {
      get: () => {
        throw new Error('Metadata read too early')
      }
    })
    expect(() => checkpoint.assertPropertiesOnly()).toThrow('must not change collections, assets')
  })

  test('captures enumerable getters once without an eligibility inspection', () => {
    const { graph, first } = setup()
    let reads = 0
    Object.defineProperty(first.source.fig.rawNodeFields, 'value', {
      enumerable: true,
      get: () => ++reads
    })
    const checkpoint = captureGraphCheckpoint(graph)
    expect(reads).toBe(1)
    expect(checkpoint.nodes.get(first.id)?.source.fig.rawNodeFields.value).toBe(1)
  })

  test('preserves within-record cycles, holes, bytes and aliases on rollback', () => {
    const { graph, first } = setup()
    const buffer = new ArrayBuffer(4)
    const shared = { value: 1 }
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    const sparse: unknown[] = []
    sparse.length = 3
    sparse[1] = undefined
    first.source.fig.rawNodeFields = {
      value: -0,
      shared,
      alias: shared,
      cycle,
      sparse,
      set: new Set(['first', 'second']),
      buffer,
      view: new Uint8Array(buffer)
    }
    const checkpoint = captureGraphCheckpoint(graph)
    shared.value = 2
    new Uint8Array(buffer)[0] = 9
    first.source.fig.rawNodeFields = {}
    checkpoint.restore()
    const restored = first.source.fig.rawNodeFields
    expect(restored.shared).toEqual({ value: 1 })
    expect(restored.alias).toBe(restored.shared)
    const restoredCycle = restored.cycle
    if (!restoredCycle || typeof restoredCycle !== 'object' || !('self' in restoredCycle))
      throw new Error('Missing restored cycle')
    expect(restoredCycle.self).toBe(restoredCycle)
    const restoredSparse = restored.sparse as unknown[]
    expect(restoredSparse.length).toBe(3)
    expect(Object.hasOwn(restoredSparse, 0)).toBe(false)
    expect(Object.hasOwn(restoredSparse, 1)).toBe(true)
    expect(Object.hasOwn(restoredSparse, 2)).toBe(false)
    expect(Object.is(restored.value, -0)).toBe(true)
    expect([...(restored.set as Set<string>)]).toEqual(['first', 'second'])
    const view = restored.view as Uint8Array
    expect(view.buffer).toBe(restored.buffer as ArrayBuffer)
    expect(view[0]).toBe(0)
  })

  test('keeps composite aliases across records and to the snapshot container', () => {
    const { graph, first, second } = setup()
    const shared = { value: 1 }
    first.source.fig.rawNodeFields.shared = shared
    second.source.fig.rawNodeFields.shared = shared
    first.source.fig.rawNodeFields.container = graph.nodes
    const checkpoint = captureGraphCheckpoint(graph)
    const saved = checkpoint.nodes.get(first.id)?.source.fig.rawNodeFields
    expect(saved?.shared).toBe(checkpoint.nodes.get(second.id)?.source.fig.rawNodeFields.shared)
    expect(saved?.container).toBe(checkpoint.nodes)
  })
})

describe('instance index comparison', () => {
  test.each(['map', 'set'])('preserves generic behavior for collection Proxies: %s', (kind) => {
    const before = new Map([['component', new Set(['instance'])]])
    const collection = kind === 'map' ? new Map(before) : new Set(['instance'])
    const proxy = new Proxy(collection, {
      get: (target, key) => {
        const value: unknown = Reflect.get(target, key, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
      getPrototypeOf: () => {
        throw new Error('Unexpected prototype inspection')
      },
      ownKeys: () => {
        throw new Error('Unexpected key inspection')
      }
    })
    const after = kind === 'map' ? proxy : new Map([['component', proxy]])
    expect(isEqual(before, after)).toBe(true)
    expect(equalInstanceIndexes(before, after)).toBe(true)
  })

  test('accepts reordered string IDs and rejects additions, removals and moved instances', () => {
    const before = new Map([
      ['first', new Set(['one', 'two'])],
      ['second', new Set(['three'])]
    ])
    expect(
      equalInstanceIndexes(
        before,
        new Map([
          ['second', new Set(['three'])],
          ['first', new Set(['two', 'one'])]
        ])
      )
    ).toBe(true)
    expect(equalInstanceIndexes(before, new Map([['first', new Set(['one', 'two'])]]))).toBe(false)
    expect(
      equalInstanceIndexes(
        before,
        new Map([
          ['first', new Set(['one', 'three'])],
          ['second', new Set(['two'])]
        ])
      )
    ).toBe(false)
    expect(equalInstanceIndexes(before, new Map([...before, ['third', new Set<string>()]]))).toBe(
      false
    )
  })

  test('preserves generic equality for malformed and boxed members', () => {
    const cases: [unknown, unknown][] = [
      [new Map([['key', new Set([new Object('one')])]]), new Map([['key', new Set(['one'])]])],
      [new Map([[1, new Set([2])]]), new Map([[1, new Set([2])]])],
      [new Map([['key', new Set([{ value: 1 }])]]), new Map([['key', new Set([{ value: 1 }])]])],
      [new Map([['key', ['one']]]), new Map([['key', ['one']]])],
      [new Map(), undefined],
      [null, null]
    ]
    for (const [before, after] of cases) {
      expect(equalInstanceIndexes(before, after)).toBe(isEqual(before, after))
    }
  })
})
