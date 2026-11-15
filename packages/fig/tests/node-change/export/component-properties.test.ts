import { describe, expect, test } from 'bun:test'

import { componentPropDefsOf, componentPropRefsOf } from '#fig-tests/helpers/component-props'
import { buildComponentPropIndex, sceneNodeToKiwi } from '#fig/node-change/index'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { GUID } from '@open-pencil/scene-graph/primitives'
import { expectDefined } from '@open-pencil/test-support/assert'

describe('exporting component properties', () => {
  test('reuses an export-scoped component property definition index', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      componentPropertyDefinitions: [
        { id: '1:100', name: 'Label', type: 'TEXT', defaultValue: 'Default' }
      ]
    })
    const instance = graph.createNode('INSTANCE', page.id, {
      componentId: component.id,
      componentPropertyAssignments: { '1:100': 'Override' }
    })
    const serialize = (definitions?: ReturnType<typeof buildComponentPropIndex>) =>
      sceneNodeToKiwi(instance, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [], {
        nodeIdToGuid: new Map(),
        assignedGuidValues: new Set(),
        componentPropertyDefinitionsById: definitions
      })[0].componentPropAssignments

    const definitions = buildComponentPropIndex(graph)
    expect(definitions.get('1:100')).toBe(component.componentPropertyDefinitions[0])
    expect(serialize(definitions)).toEqual(serialize())
  })

  test('mints a synthetic GUID for app-created (non-Figma-shaped) component property IDs', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const componentSet = graph.createNode('COMPONENT_SET', page.id, {
      componentPropertyDefinitions: [
        {
          id: 'prop:abc12345',
          name: 'Style',
          type: 'VARIANT',
          defaultValue: 'Primary',
          variantOptions: ['Primary', 'Secondary']
        }
      ]
    })

    const [change] = sceneNodeToKiwi(
      componentSet,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(change.componentPropDefs).toHaveLength(1)
    expect(componentPropDefsOf(change)?.[0].id).toEqual(
      expect.objectContaining({ sessionID: expect.any(Number), localID: expect.any(Number) })
    )
    expect(componentPropDefsOf(change)?.[0].name).toBe('Style')
  })

  test('reuses the same synthetic GUID for a def and the ref that points at it', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      componentPropertyDefinitions: [
        { id: 'prop:icon1234', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: '' }
      ]
    })
    const slot = graph.createNode('INSTANCE', component.id, {
      componentPropertyReferences: [{ propertyId: 'prop:icon1234', field: 'INSTANCE_SWAP' }]
    })

    const nodeIdToGuid = new Map<string, GUID>()
    const propertyIdToGuid = new Map<string, GUID>()
    const localIdCounter = { value: 2 }
    const [componentChange] = sceneNodeToKiwi(
      component,
      { sessionID: 1, localID: 1 },
      0,
      localIdCounter,
      graph,
      [],
      { nodeIdToGuid, propertyIdToGuid }
    )
    const slotChange = sceneNodeToKiwi(
      slot,
      expectDefined(componentChange.guid, 'component guid'),
      0,
      localIdCounter,
      graph,
      [],
      { nodeIdToGuid, propertyIdToGuid }
    )[0]

    expect(componentPropDefsOf(componentChange)?.[0].id).toEqual(
      componentPropRefsOf(slotChange)?.[0].defID
    )
  })

  test('points an INSTANCE_SWAP default value at the same GUID the target component is exported with', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const icon = graph.createNode('COMPONENT', page.id, {
      name: 'Icon/Tune',
      componentKey: 'icon-tune-key'
    })
    const button = graph.createNode('COMPONENT', page.id, {
      componentPropertyDefinitions: [
        { id: 'prop:iconswap1', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: icon.id }
      ]
    })

    const nodeIdToGuid = new Map<string, GUID>()
    const propertyIdToGuid = new Map<string, GUID>()
    const localIdCounter = { value: 2 }
    const [iconChange] = sceneNodeToKiwi(
      icon,
      { sessionID: 1, localID: 1 },
      0,
      localIdCounter,
      graph,
      [],
      { nodeIdToGuid, propertyIdToGuid }
    )
    const [buttonChange] = sceneNodeToKiwi(
      button,
      { sessionID: 1, localID: 1 },
      1,
      localIdCounter,
      graph,
      [],
      { nodeIdToGuid, propertyIdToGuid }
    )

    expect(componentPropDefsOf(buttonChange)?.[0].initialValue).toEqual({
      guidValue: iconChange.guid
    })
    expect(componentPropDefsOf(buttonChange)?.[0].preferredValues).toBeUndefined()
  })

  test('exports INSTANCE_SWAP preferred values as component keys', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const icon = graph.createNode('COMPONENT', page.id, {
      name: 'Icon/Tune',
      componentKey: 'icon-tune-key'
    })
    const button = graph.createNode('COMPONENT', page.id, {
      componentPropertyDefinitions: [
        {
          id: 'prop:iconswap2',
          name: 'Icon',
          type: 'INSTANCE_SWAP',
          defaultValue: icon.id,
          preferredValues: [icon.id, 'external-library-key']
        }
      ]
    })

    const [buttonChange] = sceneNodeToKiwi(
      button,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(componentPropDefsOf(buttonChange)?.[0].preferredValues?.instanceSwapValues).toEqual([
      { type: 'COMPONENT', key: 'icon-tune-key' },
      { type: 'COMPONENT', key: 'external-library-key' }
    ])
  })

  test('preserves unresolved GUID-shaped INSTANCE_SWAP values as GUIDs', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      componentPropertyDefinitions: [
        { id: 'prop:iconswap3', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: '70:1' }
      ]
    })

    const [change] = sceneNodeToKiwi(
      component,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(componentPropDefsOf(change)?.[0].initialValue).toEqual({
      guidValue: { sessionID: 70, localID: 1 }
    })
  })

  test('shares synthetic property GUIDs across recursive serialization without a supplied map', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      componentPropertyDefinitions: [
        { id: 'prop:recursive', name: 'Label', type: 'TEXT', defaultValue: 'Default' }
      ]
    })
    graph.createNode('TEXT', component.id, {
      componentPropertyReferences: [{ propertyId: 'prop:recursive', field: 'TEXT' }]
    })

    const changes = sceneNodeToKiwi(
      component,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(componentPropDefsOf(changes[0])?.[0].id).toEqual(
      componentPropRefsOf(changes[1])?.[0].defID
    )
  })
})
