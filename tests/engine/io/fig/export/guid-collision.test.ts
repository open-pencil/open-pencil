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
    if (!clone) throw new Error('Expected clone to exist')
    expect(clone.source.id).toBeNull()

    const figBytes = await exportFigFile(graph)
    const reimported = await parseFigFile(figBytes.buffer as ArrayBuffer)

    const allNodes = [...reimported.getAllNodes()]
    const rects = allNodes.filter((n) => n.type === 'RECTANGLE')
    // Both original and clone must survive
    expect(rects.length).toBe(2)
  })

  test('cross-page cloned frames survive export roundtrip', async () => {
    const graph = new SceneGraph()
    const page1 = graph.getPages()[0]
    page1.name = 'Page 1'
    const frame = graph.createNode('FRAME', page1.id, {
      name: 'A',
      width: 200,
      height: 100
    })
    graph.createNode('TEXT', frame.id, {
      name: 'Label',
      text: 'Hello',
      width: 100,
      height: 20
    })

    const clone = graph.cloneTree(frame.id, page1.id)
    expect(clone).not.toBeNull()
    if (!clone) throw new Error('Expected clone to exist')
    const page2 = graph.addPage('Page 2')
    graph.reparentNode(clone.id, page2.id)

    const figBytes = await exportFigFile(graph)
    const reimported = await parseFigFile(figBytes.buffer as ArrayBuffer)
    const pages = reimported.getPages()

    expect(pages.map((page) => page.name)).toEqual(['Page 1', 'Page 2'])
    for (const page of pages) {
      const [child] = reimported.getChildren(page.id)
      expect(child?.name).toBe('A')
      expect(child?.type).toBe('FRAME')
      expect(child ? reimported.getChildren(child.id).map((node) => node.name) : []).toEqual([
        'Label'
      ])
    }
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

  test('nodes with session-0 source.id do not collide with document GUID', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    // The document GUID is always {sessionID:0, localID:0}.
    // Imported nodes with source.id in the 0:* namespace must not reuse
    // that slot — the export must reserve the document GUID first.
    const rect1 = graph.createNode('RECTANGLE', page.id, {
      name: 'S0 Node A',
      width: 100,
      height: 50
    })
    graph.updateNode(rect1.id, {
      source: { ...rect1.source, id: '0:94', format: 'fig' }
    })

    const rect2 = graph.createNode('RECTANGLE', page.id, {
      name: 'S0 Node B',
      width: 100,
      height: 50
    })
    graph.updateNode(rect2.id, {
      source: { ...rect2.source, id: '0:94', format: 'fig' }
    })

    const figBytes = await exportFigFile(graph)
    const reimported = await parseFigFile(figBytes.buffer as ArrayBuffer)

    const allNodes = [...reimported.getAllNodes()]
    const rects = allNodes.filter(
      (n) => n.type === 'RECTANGLE' && (n.name === 'S0 Node A' || n.name === 'S0 Node B')
    )
    // Both nodes must survive — the document GUID (0:0) must not swallow them
    expect(rects.length).toBe(2)
  })
})
