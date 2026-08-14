import { describe, expect, test } from 'bun:test'

import { createLibraryRevision, materializeLibraryAsset } from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

function sourceLibrary() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected page')
  const icon = graph.createNode('COMPONENT', page.id, { name: 'Icon', componentKey: 'icon' })
  graph.createNode('ELLIPSE', icon.id, { name: 'Glyph' })
  const set = graph.createNode('COMPONENT_SET', page.id, {
    name: 'Button',
    componentKey: 'button-set',
    componentPropertyDefinitions: [
      {
        id: 'variant:size',
        name: 'Size',
        type: 'VARIANT',
        defaultValue: 'Small',
        variantOptions: ['Small', 'Large']
      }
    ]
  })
  const small = graph.createNode('COMPONENT', set.id, {
    name: 'Size=Small',
    componentKey: 'button-small',
    componentPropertyValues: { Size: 'Small' }
  })
  const nested = graph.createInstance(icon.id, small.id)
  if (!nested) throw new Error('Expected nested icon')
  const large = graph.createNode('COMPONENT', set.id, {
    name: 'Size=Large',
    componentKey: 'button-large',
    componentPropertyValues: { Size: 'Large' }
  })
  return { graph, set, small, large, icon }
}

describe('library materialization', () => {
  test('lazily imports a component set and dependencies as read-only definitions', async () => {
    const source = sourceLibrary()
    const revision = await createLibraryRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: source.graph,
      publishedAt: '2026-01-01T00:00:00.000Z'
    })
    const consumer = new SceneGraph()

    const result = materializeLibraryAsset(consumer, revision, 'button-set')
    expect(result.created).toBe(true)
    expect(consumer.getPages()).toHaveLength(1)
    expect(consumer.getPages(true)).toHaveLength(2)
    const componentSet = consumer.getNode(result.componentSetId ?? '')
    expect(componentSet?.librarySource).toMatchObject({
      identity: {
        libraryId: 'design-system',
        assetKey: 'button-set',
        revisionId: revision.manifest.revisionId
      },
      readOnly: true
    })
    expect(componentSet?.locked).toBe(true)
    expect(
      componentSet?.childIds.every((id) => consumer.getNode(id)?.librarySource?.readOnly)
    ).toBe(true)
    const instance = consumer.createInstance(result.componentId, consumer.getPages()[0]?.id ?? '')
    expect(instance?.componentId).toBe(result.componentId)
    const nestedIcon = instance
      ? consumer.getChildren(instance.id).find((node) => node.type === 'INSTANCE')
      : undefined
    expect(consumer.getNode(nestedIcon?.componentId ?? '')?.name).toBe('Icon')
    expect(consumer.enabledLibraries.get('design-system')).toEqual({
      libraryId: 'design-system',
      revisionId: revision.manifest.revisionId,
      enabled: true
    })
  })

  test('deduplicates the same stable asset revision', async () => {
    const source = sourceLibrary()
    const revision = await createLibraryRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: source.graph
    })
    const consumer = new SceneGraph()
    const first = materializeLibraryAsset(consumer, revision, 'button-set')
    const nodeCount = consumer.nodes.size
    const second = materializeLibraryAsset(consumer, revision, 'button-set')
    expect(second).toEqual({ ...first, created: false })
    expect(consumer.nodes.size).toBe(nodeCount)
  })
})
