import { describe, expect, test } from 'bun:test'

import { SceneGraph, setIdSession } from '@open-pencil/scene-graph'

import { pageId } from './helpers'

function sequence(prefix: string): () => string {
  let next = 1
  return () => `${prefix}:${next++}`
}

describe('SceneGraph ID generator', () => {
  test('scopes imported allocation through nested work and restores authoring after errors', () => {
    const graph = new SceneGraph(sequence('7'))
    const page = pageId(graph)
    const imported = sequence('12')
    expect(() => graph.applyImportedStateDuring(() => {
      expect(graph.createNode('RECTANGLE', page).id).toBe('12:1')
      graph.applyImportedStateDuring(() => {
        expect(graph.createNode('RECTANGLE', page).id).toBe('12:2')
      })
      graph.applyImportedStateDuring(() => {
        expect(graph.createNode('RECTANGLE', page).id).toBe('13:1')
      }, sequence('13'))
      expect(graph.createNode('RECTANGLE', page).id).toBe('12:3')
      throw new Error('Interrupted import')
    }, imported)).toThrow('Interrupted import')
    expect(graph.isApplyingImportedState).toBe(false)
    expect(graph.createNode('RECTANGLE', page).id).toBe('7:3')
  })

  test('uses an injected generator for the root, pages, nodes, variables, and collections', () => {
    const graph = new SceneGraph(sequence('7'))

    expect(graph.rootId).toBe('7:1')
    expect(pageId(graph)).toBe('7:2')
    expect(graph.createNode('RECTANGLE', pageId(graph)).id).toBe('7:3')
    const collection = graph.createCollection('Colors')
    expect(collection.id).toBe('7:4')
    expect(collection.defaultModeId).toBe('7:5')
    expect(graph.createVariable('Primary', 'COLOR', collection.id).id).toBe('7:6')
  })

  test('skips generated IDs already used by nodes, variables, collections, or modes', () => {
    const graph = new SceneGraph(sequence('7'))
    const page = pageId(graph)
    graph.createNode('RECTANGLE', page, { id: '7:3' })
    graph.addCollection({
      id: '7:4',
      name: 'Imported',
      modes: [{ modeId: '7:5', name: 'Light' }],
      defaultModeId: '7:5',
      variableIds: []
    })
    graph.addVariable({
      id: '7:6',
      name: 'Imported color',
      type: 'COLOR',
      collectionId: '7:4',
      valuesByMode: { '7:5': { r: 0, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })

    expect(graph.createNode('RECTANGLE', page).id).toBe('7:7')
    expect(graph.createCollection('Fresh').id).toBe('7:8')
  })

  test('skips IDs of modes added after their collection', () => {
    const graph = new SceneGraph(sequence('7'))
    const collection = graph.createCollection('Colors')
    graph.addMode(collection.id, '7:5', 'Dark')

    expect(graph.createNode('RECTANGLE', pageId(graph)).id).toBe('7:6')
  })

  test('the default generator uses uint32 GUID pairs outside the reserved sessions', () => {
    const first = new SceneGraph()
    const second = new SceneGraph()
    const ids = [first.rootId, pageId(first), second.rootId, pageId(second)]

    for (const id of ids) {
      const [session, local] = id.split(':').map(Number)
      expect(session).toBeGreaterThanOrEqual(2)
      expect(session).toBeLessThan(2 ** 32)
      expect(local).toBeGreaterThanOrEqual(0)
      expect(local).toBeLessThan(2 ** 32)
    }
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('the ID session prefixes every ID minted afterwards', () => {
    try {
      setIdSession(4_000_000_000)
      const graph = new SceneGraph()
      const ids = [graph.rootId, pageId(graph), graph.createCollection('Colors').id]
      for (const id of ids) expect(id).toMatch(/^4000000000:\d+$/)
    } finally {
      setIdSession()
    }
    expect(new SceneGraph().rootId).not.toMatch(/^0:\d+$/)
  })

  test('rejects an ID session that is not an unsigned 32-bit integer', () => {
    for (const value of [-1, 1.5, 2 ** 32, Number.NaN]) {
      expect(() => setIdSession(value)).toThrow(RangeError)
    }
  })

  test('gives a new collection and its default mode different IDs even if the generator repeats', () => {
    const ids = ['7:1', '7:2', 'same', 'same', '7:3']
    const graph = new SceneGraph(() => ids.shift() ?? 'exhausted')
    const collection = graph.createCollection('Colors')
    expect(collection.id).toBe('same')
    expect(collection.defaultModeId).toBe('7:3')
  })

  test('throws instead of hanging when the generator only returns IDs in use', () => {
    expect(() => new SceneGraph(() => 'same')).toThrow('only returned IDs that are in use')
  })

  test('walks a sequence past more taken IDs than any fixed cap', () => {
    const graph = new SceneGraph(sequence('9'))
    const page = pageId(graph)
    for (let i = 3; i <= 2002; i++) graph.createNodeWithId(`9:${i}`, 'RECTANGLE', page)

    expect(graph.createNode('RECTANGLE', page).id).toBe('9:2003')
  })

  test('gives modes added to a collection IDs from the injected generator', () => {
    const graph = new SceneGraph(sequence('7'))
    const collection = graph.createCollection('Colors')
    const variable = graph.createVariable('Primary', 'COLOR', collection.id)
    const dark = graph.createMode(collection.id, 'Dark')
    expect(dark).toBe('7:6')
    expect(collection.modes.map((mode) => mode.modeId)).toEqual(['7:4', '7:6'])
    expect(Object.keys(variable.valuesByMode)).toContain('7:6')
    expect(graph.createMode('missing', 'Dark')).toBeUndefined()
  })
})
