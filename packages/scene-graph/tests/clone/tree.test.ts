import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { hasInstanceOverride, recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

import { expectDefined, getNodeOrThrow } from '../helpers/assert'

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

  test('a copy of an instance keeps its overrides, on the layers copied with it', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, { name: 'Button' })
    graph.createNode('TEXT', component.id, { name: 'Label', text: 'Button' })
    const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')
    const label = expectDefined(graph.getChildren(instance.id)[0], 'label')
    graph.updateNode(label.id, { text: 'Continuar' })
    recordInstanceOverride(graph, label.id, ['text'])

    const copy = expectDefined(graph.cloneTree(instance.id, page.id), 'copy')
    const copiedLabel = expectDefined(graph.getChildren(copy.id)[0], 'copied label')

    expect(copiedLabel.text).toBe('Continuar')
    expect(hasInstanceOverride(graph, copiedLabel.id, 'text')).toBe(true)
    expect(getNodeOrThrow(graph, copy.id).instanceOverrides.descendants.has(label.id)).toBe(false)
  })

  test('a copy of a frame with a component and its instance keeps the instance on the original', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const board = graph.createNode('FRAME', page.id, { name: 'Board' })
    const icon = graph.createNode('COMPONENT', board.id, { name: 'Icon' })
    graph.createNode('ELLIPSE', icon.id, { name: 'Dot' })
    const button = graph.createNode('COMPONENT', board.id, { name: 'Button' })
    const glyph = expectDefined(graph.createInstance(icon.id, button.id, { name: 'Glyph' }), 'glyph')
    const placed = expectDefined(
      graph.createInstance(button.id, board.id, { name: 'Placed' }),
      'placed button'
    )
    const placedGlyph = expectDefined(graph.getChildren(placed.id)[0], 'placed glyph')
    // A file records the component layer each copy draws; this one was renamed, too.
    setInstanceOverride(placed.instanceOverrides, placed.id, placedGlyph.id, 'sourceComponentId', glyph.id)
    graph.updateNode(placedGlyph.id, { name: 'Renamed' })

    const copy = expectDefined(graph.cloneTree(board.id, page.id), 'copy')
    const copiedPlaced = expectDefined(
      graph.getChildren(copy.id).find((node) => node.name === 'Placed'),
      'copied button'
    )
    const copiedGlyph = expectDefined(graph.getChildren(copiedPlaced.id)[0], 'copied glyph')
    graph.syncInstances(button.id)

    expect(copiedPlaced.componentId).toBe(button.id)
    expect(graph.getChildren(copiedPlaced.id).map((node) => node.id)).toEqual([copiedGlyph.id])
  })
})
