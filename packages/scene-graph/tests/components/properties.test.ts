import { describe, expect, test } from 'bun:test'

import {
  applyComponentPropertyValue,
  componentPropertyDefinitions,
  componentPropertyOwners,
  findComponentPropertyTarget,
  forEachInstanceOverride,
  removeComponentProperty,
  resolveComponentPropertyValue,
  SceneGraph
} from '@open-pencil/scene-graph'

function component(
  graph: SceneGraph,
  name: string,
  parentId: string
): ReturnType<SceneGraph['createNode']> {
  return graph.createNode('COMPONENT', parentId, { name })
}

describe('component properties', () => {
  test('resolves component and component-set owners and definitions', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const first = component(graph, 'Button/Default', page.id)
    const second = component(graph, 'Button/Hover', page.id)
    const set = graph.createNode('COMPONENT_SET', page.id)
    graph.reparentNode(first.id, set.id)
    graph.reparentNode(second.id, set.id)
    const instance = graph.createInstance(first.id, page.id)
    if (!instance) throw new Error('instance creation failed')
    graph.updateNode(set.id, {
      componentPropertyDefinitions: [
        { id: 'prop:state', name: 'State', type: 'VARIANT', defaultValue: 'Default' }
      ]
    })

    expect(componentPropertyOwners(graph, instance).map((node) => node.id)).toEqual([
      set.id,
      first.id
    ])
    expect(
      componentPropertyDefinitions(graph, instance).map((definition) => definition.id)
    ).toEqual(['prop:state'])
  })

  test('resolves component IDs, keys, library keys, and component-set defaults', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const icon = component(graph, 'Icon', page.id)
    const keyed = component(graph, 'Keyed', page.id)
    graph.updateNode(keyed.id, { componentKey: 'icon-key' })
    const library = component(graph, 'Library', page.id)
    graph.updateNode(library.id, { sourceLibraryKey: 'library-key' })
    const set = graph.createNode('COMPONENT_SET', page.id)
    graph.reparentNode(icon.id, set.id)

    expect(resolveComponentPropertyValue(graph, keyed.id)?.id).toBe(keyed.id)
    expect(resolveComponentPropertyValue(graph, 'icon-key')?.id).toBe(keyed.id)
    expect(resolveComponentPropertyValue(graph, 'library-key')?.id).toBe(library.id)
    expect(resolveComponentPropertyValue(graph, set.id)?.id).toBe(icon.id)
  })

  test('applies text, boolean, and instance-swap properties to nested targets', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const host = component(graph, 'Host', page.id)
    const icon = component(graph, 'Icon', page.id)
    const alternate = component(graph, 'Alternate', page.id)
    const slot = graph.createInstance(icon.id, host.id)
    if (!slot) throw new Error('slot creation failed')
    graph.updateNode(host.id, {
      componentPropertyDefinitions: [
        { id: 'prop:swap', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: icon.id },
        { id: 'prop:text', name: 'Label', type: 'TEXT', defaultValue: '' },
        { id: 'prop:visible', name: 'Visible', type: 'BOOLEAN', defaultValue: 'true' }
      ]
    })
    graph.updateNode(slot.id, {
      componentPropertyReferences: [{ propertyId: 'prop:swap', field: 'INSTANCE_SWAP' }]
    })
    const text = graph.createNode('TEXT', slot.id)
    graph.updateNode(text.id, {
      text: '',
      componentPropertyReferences: [{ propertyId: 'prop:text', field: 'TEXT' }]
    })
    const visibility = graph.createNode('FRAME', slot.id)
    graph.updateNode(visibility.id, {
      componentPropertyReferences: [{ propertyId: 'prop:visible', field: 'VISIBLE' }]
    })
    const instance = graph.createInstance(host.id, page.id)
    if (!instance) throw new Error('host instance creation failed')

    const textDefinition = host.componentPropertyDefinitions[1]
    applyComponentPropertyValue(graph, instance.id, textDefinition, 'Save')
    expect(findComponentPropertyTarget(graph, instance, 'prop:text')?.node.text).toBe('Save')
    const visibleDefinition = host.componentPropertyDefinitions[2]
    applyComponentPropertyValue(graph, instance.id, visibleDefinition, 'false')
    expect(findComponentPropertyTarget(graph, instance, 'prop:visible')?.node.visible).toBe(false)

    const swapDefinition = host.componentPropertyDefinitions[0]
    const swapped = applyComponentPropertyValue(graph, instance.id, swapDefinition, alternate.id)
    expect(swapped?.id).toBe(alternate.id)
    const updatedInstance = graph.getNode(instance.id)
    expect(updatedInstance?.componentPropertyAssignments['prop:swap']).toBe(alternate.id)
    expect(
      (() => {
        let found = false
        forEachInstanceOverride(
          updatedInstance?.instanceOverrides ?? { self: new Map(), descendants: new Map() },
          (_nodeId, field) => {
            if (field === 'componentId') found = true
          }
        )
        return found
      })()
    ).toBe(true)

    const target = findComponentPropertyTarget(graph, instance, 'prop:swap')?.node
    expect(target?.type).toBe('INSTANCE')
    expect(target?.componentId).toBe(alternate.id)
  })

  test('rejects variant assignment', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const host = component(graph, 'Host', page.id)
    graph.updateNode(host.id, {
      componentPropertyDefinitions: [
        { id: 'prop:variant', name: 'State', type: 'VARIANT', defaultValue: 'Default' }
      ]
    })
    const instance = graph.createInstance(host.id, page.id)
    if (!instance) throw new Error('instance creation failed')

    expect(
      applyComponentPropertyValue(graph, instance.id, host.componentPropertyDefinitions[0], 'Hover')
    ).toBeNull()
    expect(graph.getNode(instance.id)?.componentPropertyAssignments).toEqual({})
  })
  test('removes definitions, references, and assignments', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const host = component(graph, 'Host', page.id)
    const icon = component(graph, 'Icon', page.id)
    const slot = graph.createInstance(icon.id, host.id)
    if (!slot) throw new Error('slot creation failed')
    graph.updateNode(host.id, {
      componentPropertyDefinitions: [
        { id: 'prop:swap', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: icon.id }
      ]
    })
    graph.updateNode(slot.id, {
      componentPropertyReferences: [{ propertyId: 'prop:swap', field: 'INSTANCE_SWAP' }]
    })
    const instance = graph.createInstance(host.id, page.id)
    if (!instance) throw new Error('instance creation failed')
    graph.updateNode(instance.id, { componentPropertyAssignments: { 'prop:swap': icon.id } })

    expect(removeComponentProperty(graph, host.id, 'prop:swap')).toBe(true)
    expect(graph.getNode(host.id)?.componentPropertyDefinitions).toEqual([])
    expect(graph.getNode(slot.id)?.componentPropertyReferences).toEqual([])
    expect(graph.getNode(instance.id)?.componentPropertyAssignments).toEqual({})
  })
})
