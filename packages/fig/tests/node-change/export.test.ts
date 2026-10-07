import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#fig-tests/helpers/assert'
import { componentPropDefsOf, componentPropRefsOf } from '#fig-tests/helpers/component-props'
import { symbolDataOf } from '#fig/instance-overrides/types'
import {
  buildComponentPropIndex,
  mapToFigmaType,
  sceneNodeToKiwi,
  type FigNodeChangeExportRuntime
} from '#fig/node-change/index'

import { SceneGraph } from '@open-pencil/scene-graph'
import { fractionalPosition } from '@open-pencil/scene-graph/order-keys'
import type { GUID } from '@open-pencil/scene-graph/primitives'

describe('@open-pencil/fig SceneGraph export policy', () => {
  test('maps node types deterministically', () => {
    expect(mapToFigmaType('COMPONENT')).toBe('SYMBOL')
  })

  test('exports one ordering scheme when preserved and generated siblings are mixed', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id)
    node.source.orderKey = 'z'
    const change = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    expect(change[0]?.parentIndex?.position).toBe(fractionalPosition(0))
  })

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

  test('merges edited text into an existing override path', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id)
    const sourceText = graph.createNode('TEXT', component.id, {
      overrideKey: '2:20',
      text: 'Default'
    })
    const created = graph.createInstance(component.id, page.id)
    expect(created).toBeDefined()
    const instance = expectDefined(created, 'instance')
    const targetText = graph.getChildren(instance.id)[0]
    expect(targetText).toBeDefined()
    const originalOverride = {
      guidPath: { guids: [{ sessionID: 2, localID: 20 }] },
      textData: { characters: 'Stale' },
      opacity: 0.5
    }
    graph.updateNode(instance.id, {
      instanceOverrides: {
        self: new Map(),
        descendants: new Map([[targetText.id, new Map([['text', 'Edited']])]])
      },
      source: {
        ...instance.source,
        fig: {
          ...instance.source.fig,
          symbolOverrides: [originalOverride]
        }
      }
    })

    const [change] = sceneNodeToKiwi(
      graph.getNode(instance.id) ?? instance,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(sourceText.overrideKey).toBe('2:20')
    expect(symbolDataOf(change)?.symbolOverrides).toEqual([
      {
        ...originalOverride,
        textData: { characters: 'Edited' }
      }
    ])
  })

  test('writes text shaped by the runtime as derived text data', () => {
    const graph = new SceneGraph()
    const text = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'A',
      width: 20,
      height: 20,
      fontSize: 16
    })
    const blobs: Uint8Array[] = []
    const runtime: FigNodeChangeExportRuntime = {
      shapeText: () => ({
        glyphs: [
          {
            commands: [{ type: 'M', x: 0, y: 0 }, { type: 'L', x: 8, y: 16 }, { type: 'Z' }],
            x: 0,
            y: 15,
            fontSize: 16,
            firstCharacter: 0,
            advance: 10
          }
        ],
        baselines: [
          {
            firstCharacter: 0,
            endCharacter: 1,
            position: { x: 0, y: 15 },
            width: 10,
            lineY: 0,
            lineHeight: 19,
            lineAscent: 15
          }
        ],
        logicalIndexToCharacterOffsetMap: [0]
      })
    }

    const [change] = sceneNodeToKiwi(
      text,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      blobs,
      {
        fontDigestMap: new Map([['Inter|Regular', new Uint8Array([1, 2, 3])]]),
        glyphBlobMap: new Map(),
        runtime
      }
    )

    expect(change.derivedTextData?.glyphs).toHaveLength(1)
    expect(change.derivedTextData?.baselines?.[0]?.position.y).toBe(15)
    expect(blobs).toHaveLength(1)
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

  test('keeps colorVar bindings on imported nodes with stale raw paints', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const collection = graph.createCollection('Tokens')
    const brand = graph.createVariable('brand', 'COLOR', collection.id, {
      r: 0.2,
      g: 0.4,
      b: 0.9,
      a: 1
    })
    const color = { r: 0.2, g: 0.4, b: 0.9, a: 1 }
    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'ImportedBound',
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color, opacity: 1, visible: true }]
    })
    const current = graph.getNode(node.id)
    if (!current) throw new Error('Expected rectangle node')
    // Simulate an imported node whose raw paints predate the binding.
    graph.updateNode(node.id, {
      boundVariables: { 'fills/0/color': brand.id },
      source: {
        ...current.source,
        id: '1:2',
        fig: {
          ...current.source.fig,
          rawNodeFields: {
            ...current.source.fig.rawNodeFields,
            fillPaints: [
              {
                type: 'SOLID',
                color,
                opacity: 1,
                visible: true,
                blendMode: 'NORMAL'
              }
            ]
          }
        }
      }
    })
    const updated = graph.getNode(node.id)
    if (!updated) throw new Error('Expected updated node')

    const [change] = sceneNodeToKiwi(
      updated,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(change.fillPaints?.[0]?.colorVar?.resolvedDataType).toBe('COLOR')
  })

  test('drops a raw colorVar when the imported node is no longer bound', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const color = { r: 0.2, g: 0.4, b: 0.9, a: 1 }
    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'ImportedUnbound',
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color, opacity: 1, visible: true }]
    })
    const current = graph.getNode(node.id)
    if (!current) throw new Error('Expected rectangle node')
    // Simulate an imported node that Figma saved with a binding the user has since removed.
    graph.updateNode(node.id, {
      boundVariables: {},
      source: {
        ...current.source,
        id: '1:2',
        fig: {
          ...current.source.fig,
          rawNodeFields: {
            ...current.source.fig.rawNodeFields,
            fillPaints: [
              {
                type: 'SOLID',
                color,
                opacity: 1,
                visible: true,
                blendMode: 'NORMAL',
                colorVar: {
                  value: { alias: { guid: { sessionID: 0, localID: 12 } } },
                  dataType: 'ALIAS',
                  resolvedDataType: 'COLOR'
                }
              }
            ]
          }
        }
      }
    })
    const updated = graph.getNode(node.id)
    if (!updated) throw new Error('Expected updated node')

    const [change] = sceneNodeToKiwi(
      updated,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(change.fillPaints?.[0]).toMatchObject({ type: 'SOLID', blendMode: 'NORMAL' })
    expect(change.fillPaints?.[0]?.colorVar).toBeUndefined()
  })

  test('drops the OpenPencil bindings entry when an imported node is no longer bound', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'ImportedPluginBinding',
      width: 40,
      height: 40,
      boundVariables: {},
      pluginData: [
        { pluginId: 'open-pencil', key: 'boundVariables', value: '{"fills/0/color":"0:12"}' },
        { pluginId: 'other-plugin', key: 'boundVariables', value: 'kept' }
      ]
    })

    const [change] = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])

    const bindingEntries = (change.pluginData ?? []).filter(
      (entry) => entry.key === 'boundVariables'
    )
    expect(bindingEntries).toEqual([
      { pluginID: 'other-plugin', key: 'boundVariables', value: 'kept' }
    ])
  })
})

function expectStrictlyIncreasing(keys: string[]) {
  for (let i = 1; i < keys.length; i++) expect(keys[i] > keys[i - 1]).toBe(true)
}

describe('Figma export order keys', () => {
  test('a layer added before imported siblings does not share their keys', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { name: 'Frame' })
    for (const [name, orderKey] of [
      ['A', '!'],
      ['B', '"'],
      ['C', '#']
    ]) {
      const child = graph.createNode('RECTANGLE', frame.id, { name })
      child.source.orderKey = orderKey
    }
    const inserted = graph.createNode('RECTANGLE', frame.id, { name: 'Inserted' })
    frame.childIds = [inserted.id, ...frame.childIds.filter((id) => id !== inserted.id)]

    const changes = sceneNodeToKiwi(frame, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    const children = changes.slice(1)
    const positions = children.map((change) => change.parentIndex?.position ?? '')

    expect(children.map((change) => change.name)).toEqual(['Inserted', 'A', 'B', 'C'])
    // Nothing sorts before '!', so A is re-keyed; B and C keep their imported keys.
    expect(positions.slice(2)).toEqual(['"', '#'])
    expect(new Set(positions).size).toBe(4)
    expectStrictlyIncreasing(positions)
  })
})
