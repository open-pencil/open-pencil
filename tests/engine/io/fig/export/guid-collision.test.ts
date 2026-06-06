import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'

/**
 * Regression test: two distinct nodes sharing the same source.id
 * (as happens with component-instance children) must receive
 * different GUIDs on export, preventing silent data loss on reimport.
 */
describe('export: GUID collision prevention', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('two nodes with same source.id get different GUIDs on export', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    // Create two nodes that share the same Figma source.id
    // (simulates component master + instance child)
    const rect1 = graph.createNode('RECTANGLE', page.id, {
      name: 'Master Child',
      width: 100,
      height: 50
    })
    graph.updateNode(rect1.id, {
      source: { ...rect1.source, id: '1:94', format: 'fig' }
    })

    const rect2 = graph.createNode('RECTANGLE', page.id, {
      name: 'Instance Child',
      width: 100,
      height: 50
    })
    graph.updateNode(rect2.id, {
      source: { ...rect2.source, id: '1:94', format: 'fig' }
    })

    const figBytes = await exportFigFile(graph)
    const reimported = await parseFigFile(figBytes.buffer as ArrayBuffer)

    // Both nodes must survive reimport — no silent last-write-wins
    const allNodes = [...reimported.getAllNodes()]
    const rects = allNodes.filter(
      (n) => n.type === 'RECTANGLE' && (n.name === 'Master Child' || n.name === 'Instance Child')
    )
    expect(rects.length).toBe(2)
  })

  test('cloned node does not collide with original GUID', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Original',
      width: 100,
      height: 50
    })
    graph.updateNode(rect.id, {
      source: { ...rect.source, id: '1:200', format: 'fig' }
    })

    // Clone the node — cloneTree should clear source.id
    const clone = graph.cloneTree(rect.id, page.id)
    expect(clone).not.toBeNull()
    expect(clone.source.id).toBeNull()

    const figBytes = await exportFigFile(graph)
    const reimported = await parseFigFile(figBytes.buffer as ArrayBuffer)

    const allNodes = [...reimported.getAllNodes()]
    const rects = allNodes.filter((n) => n.type === 'RECTANGLE')
    // Both original and clone must survive
    expect(rects.length).toBe(2)
  })

  test('export roundtrip preserves three nodes with identical source.id', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    for (let i = 0; i < 3; i++) {
      const rect = graph.createNode('RECTANGLE', page.id, {
        name: `Rect ${i}`,
        width: 50,
        height: 50
      })
      graph.updateNode(rect.id, {
        source: { ...rect.source, id: '1:500', format: 'fig' }
      })
    }

    const figBytes = await exportFigFile(graph)
    const reimported = await parseFigFile(figBytes.buffer as ArrayBuffer)

    const allNodes = [...reimported.getAllNodes()]
    const rects = allNodes.filter((n) => n.type === 'RECTANGLE')
    expect(rects.length).toBe(3)
  })
})
