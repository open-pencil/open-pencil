import { describe, expect, test } from 'bun:test'

import { createSessionIdGenerator, SceneGraph } from '@open-pencil/scene-graph'

describe('experimental session identity', () => {
  test('independent sessions create distinct nodes, variables, collections and modes', () => {
    const graphs = [41, 42].map((session) => new SceneGraph(createSessionIdGenerator(session)))
    const identities = graphs.map((graph) => {
      const node = graph.createNode('RECTANGLE', graph.getPages()[0].id)
      const collection = graph.createCollection('Colors')
      const variable = graph.createVariable('Accent', 'COLOR', collection.id)
      return [
        graph.rootId,
        graph.getPages()[0].id,
        node.id,
        collection.id,
        collection.defaultModeId,
        variable.id
      ]
    })
    expect(new Set(identities.flat()).size).toBe(12)
    expect(identities[0]).toEqual(['41:1', '41:2', '41:3', '41:4', '41:5', '41:6'])
  })

  test('fresh processes use different nonzero session namespaces', () => {
    const script = `import { createSessionIdGenerator } from '@open-pencil/scene-graph';
      process.stdout.write(createSessionIdGenerator()())`
    const run = () => {
      const result = Bun.spawnSync([process.execPath, '-e', script])
      expect(result.exitCode).toBe(0)
      return result.stdout.toString()
    }
    const first = run()
    const second = run()
    expect(first).toMatch(/^[1-9]\d*:1$/)
    expect(second).toMatch(/^[1-9]\d*:1$/)
    expect(first).not.toBe(second)
  })

  test('reloaded identities survive and imported IDs are skipped', () => {
    const original = new SceneGraph(createSessionIdGenerator(41))
    const imported = original.createNode('RECTANGLE', original.getPages()[0].id)
    const restored = new SceneGraph(createSessionIdGenerator(41))
    restored.nodes = structuredClone(original.nodes)
    restored.rootId = original.rootId
    const created = restored.createNode('RECTANGLE', restored.getPages()[0].id)
    expect(restored.getNode(imported.id)?.id).toBe(imported.id)
    expect(created.id).toBe('41:4')
  })

  test('variable allocation also skips imported node and mode identities', () => {
    const graph = new SceneGraph(createSessionIdGenerator(41))
    const collection = graph.createCollection('Tokens')
    graph.createNodeWithId('41:5', 'RECTANGLE', graph.getPages()[0].id)
    collection.modes.push({ modeId: '41:6', name: 'Imported mode' })
    expect(graph.createVariable('Size', 'FLOAT', collection.id).id).toBe('41:7')
  })

  test('rejects invalid session IDs', () => {
    for (const id of [0, -1, 1.5, 0x1_0000_0000, Number.NaN, Infinity]) {
      expect(() => createSessionIdGenerator(id)).toThrow('Session ID must be a nonzero uint32')
    }
  })
})
