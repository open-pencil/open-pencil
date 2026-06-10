import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

describe('SceneGraph.cloneTree', () => {
  test('clone clears source.id from the original', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Original',
      width: 100,
      height: 50
    })
    // Simulate an imported node with a Figma source.id
    graph.updateNode(rect.id, {
      source: { ...rect.source, id: '1:42', orderKey: '!', format: 'fig' }
    })
    const original = graph.getNode(rect.id)
    expect(original).toBeDefined()
    expect(original.source.id).toBe('1:42')

    const clone = graph.cloneTree(rect.id, page.id)
    expect(clone).not.toBeNull()
    // Clone must NOT carry the original's Figma GUID
    expect(clone.source.id).toBeNull()
    expect(clone.source.orderKey).toBeNull()
    // But format should be preserved
    expect(clone.source.format).toBe('fig')
  })

  test('clone of clone does not leak source.id', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Original',
      width: 100,
      height: 50
    })
    graph.updateNode(rect.id, {
      source: { ...rect.source, id: '1:99', format: 'fig' }
    })

    const clone1 = graph.cloneTree(rect.id, page.id)
    expect(clone1).not.toBeNull()
    const clone2 = graph.cloneTree(clone1.id, page.id)
    expect(clone2).not.toBeNull()
    expect(clone2.source.id).toBeNull()
  })

  test('clone preserves visual properties', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Original',
      width: 100,
      height: 50
    })
    graph.updateNode(rect.id, {
      source: { ...rect.source, id: '1:42', format: 'fig' },
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          visible: true,
          blendMode: 'NORMAL' as const
        }
      ]
    })

    const clone = graph.cloneTree(rect.id, page.id)
    expect(clone).not.toBeNull()
    expect(clone.name).toBe('Original')
    expect(clone.width).toBe(100)
    expect(clone.height).toBe(50)
    expect(clone.fills).toEqual(rect.fills)
  })

  test('clone recursively clears source.id on children', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Frame',
      width: 200,
      height: 200
    })
    graph.updateNode(frame.id, {
      source: { ...frame.source, id: '2:10', format: 'fig' }
    })
    const child = graph.createNode('RECTANGLE', frame.id, {
      name: 'Child',
      width: 50,
      height: 50
    })
    graph.updateNode(child.id, {
      source: { ...child.source, id: '2:11', format: 'fig' }
    })

    const clone = graph.cloneTree(frame.id, page.id)
    expect(clone).not.toBeNull()
    expect(clone.source.id).toBeNull()
    const clonedChild = graph.getChildren(clone.id)[0]
    expect(clonedChild.source.id).toBeNull()
  })
  test('clone deep-copies source.fig so mutations do not affect original', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Original',
      width: 100,
      height: 50
    })
    graph.updateNode(rect.id, {
      source: {
        ...rect.source,
        id: '1:42',
        orderKey: '!',
        format: 'fig',
        fig: {
          rawSize: { x: 100, y: 50 },
          rawTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
          rawNodeFields: { visible: true, opacity: 1 },
          layout: null,
          symbolOverrides: [],
          componentPropAssignments: [],
          derivedSymbolData: [],
          derivedSymbolDataLayoutVersion: null,
          uniformScaleFactor: null
        }
      }
    })

    const original = graph.getNode(rect.id)
    expect(original.source.fig.rawNodeFields).toEqual({ visible: true, opacity: 1 })

    const clone = graph.cloneTree(rect.id, page.id)
    expect(clone).not.toBeNull()

    // Mutate the clone's source.fig (simulating what clearEditedSourceMetadata does)
    clone.source.fig.rawNodeFields = {}
    clone.source.fig.rawSize = null

    // Original must be unaffected
    expect(original.source.fig.rawNodeFields).toEqual({ visible: true, opacity: 1 })
    expect(original.source.fig.rawSize).toEqual({ x: 100, y: 50 })
  })
})
