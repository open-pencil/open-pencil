import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  cloneInstanceOverrideState,
  copiedComponentLayerId,
  setInstanceOverride
} from '@open-pencil/scene-graph/instances/overrides'

import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'
describe('SceneGraph.cloneTree', () => {
  test('clone clears source.id from the clone', () => {
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
    const original = getNodeOrThrow(graph, rect.id)
    expect(original).toBeDefined()
    expect(original.source.id).toBe('1:42')

    const clone = expectDefined(graph.cloneTree(rect.id, page.id), 'clone')
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

    const clone1 = expectDefined(graph.cloneTree(rect.id, page.id), 'clone')
    expect(clone1).not.toBeNull()
    const clone2 = expectDefined(graph.cloneTree(clone1.id, page.id), 'clone')
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
          opacity: 1,
          blendMode: 'NORMAL' as const
        }
      ]
    })

    const clone = expectDefined(graph.cloneTree(rect.id, page.id), 'clone')
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

    const clone = expectDefined(graph.cloneTree(frame.id, page.id), 'clone')
    expect(clone).not.toBeNull()
    expect(clone.source.id).toBeNull()
    const clonedChild = graph.getChildren(clone.id)[0]
    expect(clonedChild.source.id).toBeNull()
  })
  // A badge with a left and a right icon, as the shadcn/ui kit draws one. A .fig file records
  // which badge layer each icon copy copies, by the copy's id: both copies are instances of the
  // same icon, so their own componentId cannot tell them apart.
  test('a cloned instance keeps which component layer each copy copies', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const icon = graph.createNode('COMPONENT', page.id, { name: 'Icon', width: 16, height: 16 })
    const badge = graph.createNode('COMPONENT', page.id, { name: 'Badge', width: 60, height: 20 })
    for (const name of ['Left', 'Right'])
      expectDefined(graph.createInstance(icon.id, badge.id, { name }), name)
    const instance = expectDefined(graph.createInstance(badge.id, page.id), 'badge instance')
    const layers = graph.getChildren(badge.id).map((layer) => layer.id)
    // As the .fig reader builds them: each icon copy names the icon itself, and the instance
    // records the badge layer it copies.
    const overrides = cloneInstanceOverrideState(instance.instanceOverrides)
    for (const [index, copy] of graph.getChildren(instance.id).entries()) {
      graph.updateNode(copy.id, { componentId: icon.id })
      setInstanceOverride(overrides, instance.id, copy.id, 'sourceComponentId', layers[index])
    }
    graph.updateNode(instance.id, { instanceOverrides: overrides })
    const sources = (id: string) => {
      const node = getNodeOrThrow(graph, id)
      return graph
        .getChildren(id)
        .map((copy) => copiedComponentLayerId(node.instanceOverrides, id, copy))
    }
    expect(sources(instance.id)).toEqual(layers)

    const clone = expectDefined(graph.cloneTree(instance.id, page.id), 'clone')
    expect(sources(clone.id)).toEqual(layers)
  })

  // Figma (desktop 126): cloning a frame that holds a component and an instance of it gives an
  // instance of the cloned component.
  test('an instance cloned with its component names the cloned component', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { name: 'Holder', width: 300, height: 100 })
    const component = graph.createNode('COMPONENT', frame.id, { name: 'Inner', width: 40 })
    expectDefined(graph.createInstance(component.id, frame.id, { x: 100 }), 'instance')
    const clone = expectDefined(graph.cloneTree(frame.id, page.id), 'clone')
    const [clonedComponent, clonedInstance] = graph.getChildren(clone.id)
    expect(clonedComponent.id).not.toBe(component.id)
    expect(clonedInstance.componentId).toBe(clonedComponent.id)
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

    const original = getNodeOrThrow(graph, rect.id)
    expect(original.source.fig.rawNodeFields).toEqual({ visible: true, opacity: 1 })

    const clone = expectDefined(graph.cloneTree(rect.id, page.id), 'clone')
    expect(clone).not.toBeNull()

    // Mutate the clone's source.fig (simulating what clearEditedSourceMetadata does)
    clone.source.fig.rawNodeFields = {}
    clone.source.fig.rawSize = null

    // Original must be unaffected
    expect(original.source.fig.rawNodeFields).toEqual({ visible: true, opacity: 1 })
    expect(original.source.fig.rawSize).toEqual({ x: 100, y: 50 })
  })
})
