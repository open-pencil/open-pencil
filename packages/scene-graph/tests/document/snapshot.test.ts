import { describe, expect, test } from 'bun:test'

import {
  createSessionIdGenerator,
  SceneGraph,
  serializeGraphSnapshot
} from '@open-pencil/scene-graph'

function fixture() {
  const graph = new SceneGraph(createSessionIdGenerator(41))
  const page = graph.getPages()[0]
  const node = graph.createNode('RECTANGLE', page.id, { name: 'Card' })
  graph.updateNode(node.id, { x: 10 })
  graph.createNode('TEXT', page.id, { text: 'Hello' })
  return { graph, page, node }
}

describe('experimental canonical graph snapshot', () => {
  test('repeated saves and fresh processes produce identical bytes', () => {
    const { graph } = fixture()
    expect(serializeGraphSnapshot(graph)).toBe(serializeGraphSnapshot(graph))
    const script = `import { createSessionIdGenerator, SceneGraph, serializeGraphSnapshot }
      from '@open-pencil/scene-graph';
      const graph = new SceneGraph(createSessionIdGenerator(41));
      const page = graph.getPages()[0];
      const card = graph.createNode('RECTANGLE', page.id, { name: 'Card' });
      graph.updateNode(card.id, { x: 10 });
      graph.createNode('TEXT', page.id, { text: 'Hello' });
      process.stdout.write(serializeGraphSnapshot(graph));`
    const result = Bun.spawnSync([process.execPath, '-e', script])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toBe(serializeGraphSnapshot(graph))
  })

  test('map insertion, nested property and edited-field order are irrelevant', () => {
    const { graph, node } = fixture()
    const collection = graph.createCollection('Tokens')
    graph.createVariable('Width', 'FLOAT', collection.id, 10)
    graph.createVariable('Height', 'FLOAT', collection.id, 20)
    graph.images.set('b', new Uint8Array([2]))
    graph.images.set('a', new Uint8Array([1]))
    node.boundVariables = { width: 'width', height: 'height' }
    node.source.editedFields = ['width', 'height']
    node.instanceOverrides.self.set('width', { defined: true, value: 10 })
    node.instanceOverrides.self.set('height', undefined)
    const before = serializeGraphSnapshot(graph)
    graph.nodes = new Map([...graph.nodes].reverse())
    graph.images = new Map([...graph.images].reverse())
    graph.variables = new Map([...graph.variables].reverse())
    node.boundVariables = { height: 'height', width: 'width' }
    node.source.editedFields.reverse()
    node.instanceOverrides.self = new Map([...node.instanceOverrides.self].reverse())
    expect(serializeGraphSnapshot(graph)).toBe(before)
    expect(node.source.editedFields).toEqual(['height', 'width'])
  })

  test('layer order, undefined overrides and binary resources remain meaningful', () => {
    const { graph, page, node } = fixture()
    const before = serializeGraphSnapshot(graph)
    page.childIds.reverse()
    expect(serializeGraphSnapshot(graph)).not.toBe(before)
    page.childIds.reverse()
    node.instanceOverrides.self.set('width', undefined)
    expect(serializeGraphSnapshot(graph)).not.toBe(before)
    node.instanceOverrides.self.clear()
    graph.images.set('image', new Uint8Array([1, 2, 3]))
    const withImage = serializeGraphSnapshot(graph)
    graph.images.set('image', new Uint8Array([1, 2, 4]))
    expect(serializeGraphSnapshot(graph)).not.toBe(withImage)
  })

  test('normalizes negative zero and ignores runtime text caches and derived indexes', () => {
    const { graph, node } = fixture()
    node.x = 0
    const before = serializeGraphSnapshot(graph)
    node.x = -0
    node.textPicture = new Uint8Array([1, 2])
    node.derivedTextGlyphs = []
    graph.instanceIndex.set('component', new Set([node.id]))
    expect(serializeGraphSnapshot(graph)).toBe(before)
  })

  test('one property edit changes only its numeric token', () => {
    const { graph, node } = fixture()
    const before = serializeGraphSnapshot(graph)
    graph.updateNode(node.id, { x: 11 })
    expect(serializeGraphSnapshot(graph)).toBe(before.replace('"x":10', '"x":11'))
  })

  test('fails loudly on non-finite numbers, cycles and unsupported source values', () => {
    const { graph, node } = fixture()
    node.x = Infinity
    expect(() => serializeGraphSnapshot(graph)).toThrow('Snapshot numbers must be finite')
    node.x = 10
    node.source.fig.rawNodeFields['cycle'] = node.source.fig.rawNodeFields
    expect(() => serializeGraphSnapshot(graph)).toThrow('Snapshot values must not contain cycles')
    node.source.fig.rawNodeFields = { unsupported: new Date() }
    expect(() => serializeGraphSnapshot(graph)).toThrow('Snapshot objects must be plain records')
  })
})
