import { describe, expect, test } from 'bun:test'

import {
  createLibraryRevision,
  createLibraryUpdatePreview,
  materializeLibraryAsset
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

function source(label: string) {
  const graph = new SceneGraph()
  const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button'
  })
  const component = graph.createNode('COMPONENT', set.id, {
    name: 'Size=Small',
    componentPropertyValues: { Size: 'Small' }
  })
  graph.createNode('TEXT', component.id, {
    name: 'Label',
    text: label,
    componentPropertyReferences: [{ propertyId: 'label', field: 'TEXT' }]
  })
  graph.updateNode(set.id, {
    componentPropertyDefinitions: [
      { id: 'label', name: 'Label', type: 'TEXT', defaultValue: label }
    ]
  })
  return graph
}

function propertySource(kind: 'VISIBLE' | 'INSTANCE_SWAP', value: string) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const alternate = graph.createNode('COMPONENT', page.id, {
    name: 'Alternate',
    componentKey: 'alternate',
    width: 40,
    height: 40
  })
  const component = graph.createNode('COMPONENT', page.id, {
    name: 'Card',
    componentKey: 'card',
    componentPropertyDefinitions: [
      {
        id: 'property',
        name: 'Property',
        type: kind === 'VISIBLE' ? 'BOOLEAN' : 'INSTANCE_SWAP',
        defaultValue: value
      }
    ]
  })
  if (kind === 'VISIBLE') {
    graph.createNode('RECTANGLE', component.id, {
      name: 'Optional',
      visible: true,
      componentPropertyReferences: [{ propertyId: 'property', field: 'VISIBLE' }]
    })
  } else {
    graph.createNode('INSTANCE', component.id, {
      name: 'Nested',
      componentId: alternate.id,
      componentPropertyReferences: [{ propertyId: 'property', field: 'INSTANCE_SWAP' }]
    })
  }
  return graph
}

async function revisions(firstGraph: SceneGraph, latestGraph: SceneGraph, assetKey: string) {
  const first = await createLibraryRevision({
    libraryId: 'library',
    name: 'Library',
    graph: firstGraph
  })
  const latest = await createLibraryRevision({
    libraryId: 'library',
    name: 'Library',
    graph: latestGraph,
    previousRevisionId: first.manifest.revisionId
  })
  const consumer = new SceneGraph()
  const definition = materializeLibraryAsset(consumer, first, assetKey)
  return { latest, consumer, definition }
}

describe('library update preview', () => {
  test('builds an isolated exact-variant comparison without mutating the consumer', async () => {
    const first = await createLibraryRevision({
      libraryId: 'library',
      name: 'Library',
      graph: source('Old')
    })
    const latest = await createLibraryRevision({
      libraryId: 'library',
      name: 'Library',
      graph: source('New'),
      previousRevisionId: first.manifest.revisionId
    })
    const consumer = new SceneGraph()
    const definition = materializeLibraryAsset(consumer, first, 'button')
    const instance = consumer.createNode('INSTANCE', consumer.getPages()[0].id, {
      componentId: definition.componentId,
      componentPropertyAssignments: { label: 'Custom' }
    })
    const beforeNodes = [...consumer.nodes]
    const beforeBindings = [...consumer.enabledLibraries]

    const preview = createLibraryUpdatePreview(consumer, instance.id, latest)

    expect(preview.fallback).toBe(false)
    expect(preview.graph.getNode(preview.currentNodeId)?.type).toBe('INSTANCE')
    expect(preview.graph.getNode(preview.updatedNodeId)?.type).toBe('INSTANCE')
    const currentComponentId = preview.graph.getNode(preview.currentNodeId)?.componentId
    const updatedComponentId = preview.graph.getNode(preview.updatedNodeId)?.componentId
    expect(
      currentComponentId ? preview.graph.getNode(currentComponentId)?.componentPropertyValues : null
    ).toEqual({ Size: 'Small' })
    expect(
      updatedComponentId ? preview.graph.getNode(updatedComponentId)?.componentPropertyValues : null
    ).toEqual({ Size: 'Small' })
    expect(
      preview.graph.getChildren(preview.currentNodeId).find((node) => node.type === 'TEXT')?.text
    ).toBe('Custom')
    expect(
      preview.graph.getChildren(preview.updatedNodeId).find((node) => node.type === 'TEXT')?.text
    ).toBe('Custom')
    expect([...consumer.nodes]).toEqual(beforeNodes)
    expect([...consumer.enabledLibraries]).toEqual(beforeBindings)
  })

  test('reapplies boolean visibility properties to both previews', async () => {
    const { latest, consumer, definition } = await revisions(
      propertySource('VISIBLE', 'true'),
      propertySource('VISIBLE', 'true'),
      'card'
    )
    const instance = consumer.createNode('INSTANCE', consumer.getPages()[0].id, {
      componentId: definition.componentId,
      componentPropertyAssignments: { property: 'false' }
    })
    const preview = createLibraryUpdatePreview(consumer, instance.id, latest)
    for (const id of [preview.currentNodeId, preview.updatedNodeId]) {
      expect(preview.graph.getChildren(id)[0]?.visible).toBe(false)
    }
  })

  test('reapplies nested instance swaps using preview-local definitions', async () => {
    const firstGraph = propertySource('INSTANCE_SWAP', 'alternate')
    const latestGraph = propertySource('INSTANCE_SWAP', 'alternate')
    latestGraph.createNode('COMPONENT', latestGraph.getPages()[0].id, {
      name: 'Replacement',
      componentKey: 'replacement'
    })
    const { latest, consumer, definition } = await revisions(firstGraph, latestGraph, 'card')
    const instance = consumer.createNode('INSTANCE', consumer.getPages()[0].id, {
      componentId: definition.componentId,
      componentPropertyAssignments: { property: 'replacement' }
    })
    const preview = createLibraryUpdatePreview(consumer, instance.id, latest)
    const nested = preview.graph
      .getChildren(preview.updatedNodeId)
      .find((node) => node.type === 'INSTANCE')
    expect(nested?.componentId ? preview.graph.getNode(nested.componentId)?.name : null).toBe(
      'Replacement'
    )
  })

  test('copies current-side nested definitions and remaps their instances', async () => {
    const firstGraph = propertySource('INSTANCE_SWAP', 'alternate')
    const latestGraph = propertySource('INSTANCE_SWAP', 'alternate')
    const { latest, consumer, definition } = await revisions(firstGraph, latestGraph, 'card')
    const instance = consumer.createNode('INSTANCE', consumer.getPages()[0].id, {
      componentId: definition.componentId
    })

    const preview = createLibraryUpdatePreview(consumer, instance.id, latest)
    const currentNested = preview.graph
      .getChildren(preview.currentNodeId)
      .find((node) => node.type === 'INSTANCE')
    const currentDefinitionNode = currentNested?.componentId
      ? preview.graph.getNode(currentNested.componentId)
      : null
    const currentDependency = currentDefinitionNode?.componentId
      ? preview.graph.getNode(currentDefinitionNode.componentId)
      : null

    expect(currentDefinitionNode?.name).toBe('Nested')
    expect(currentDependency?.name).toBe('Alternate')
    expect(currentDependency?.parentId).toBe(preview.graph.getPages()[0].id)
    expect(consumer.getNode(currentNested?.componentId ?? '')).toBeUndefined()
  })

  test('reports top-left fallback and reapplies compatible assignments', async () => {
    const firstGraph = source('Old')
    const latestGraph = source('Fallback')
    const set = [...latestGraph.getAllNodes()].find((node) => node.type === 'COMPONENT_SET')
    const variant = set ? latestGraph.getChildren(set.id)[0] : null
    if (!variant) throw new Error('Latest variant missing')
    latestGraph.updateNode(variant.id, {
      name: 'Size=Large',
      componentPropertyValues: { Size: 'Large' },
      x: 0,
      y: 0
    })
    const { latest, consumer, definition } = await revisions(firstGraph, latestGraph, 'button')
    const instance = consumer.createNode('INSTANCE', consumer.getPages()[0].id, {
      componentId: definition.componentId,
      componentPropertyAssignments: { label: 'Custom fallback' }
    })
    const preview = createLibraryUpdatePreview(consumer, instance.id, latest)
    expect(preview.fallback).toBe(true)
    const componentId = preview.graph.getNode(preview.updatedNodeId)?.componentId
    expect(
      componentId ? preview.graph.getNode(componentId)?.componentPropertyValues : null
    ).toEqual({ Size: 'Large' })
    expect(
      preview.graph.getChildren(preview.updatedNodeId).find((node) => node.type === 'TEXT')?.text
    ).toBe('Custom fallback')
  })
})
