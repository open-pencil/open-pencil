import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { GUID } from '@open-pencil/scene-graph/primitives'

import {
  buildComponentPropIndex,
  fractionalPosition,
  mapToFigmaType,
  sceneNodeToKiwi,
  type FigNodeChangeExportRuntime
} from '../src/node-change'

describe('@open-pencil/fig SceneGraph export policy', () => {
  test('maps node types and sibling positions deterministically', () => {
    expect(mapToFigmaType('COMPONENT')).toBe('SYMBOL')
    expect([0, 93, 94, 188].map(fractionalPosition)).toEqual(['!', '~', '~!', '~~!'])
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
      sceneNodeToKiwi(
        instance,
        { sessionID: 1, localID: 1 },
        0,
        { value: 2 },
        graph,
        [],
        new Map(),
        undefined,
        undefined,
        undefined,
        undefined,
        new Set(),
        undefined,
        definitions
      )[0].componentPropAssignments

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
    const instance = graph.createInstance(component.id, page.id)
    expect(instance).toBeDefined()
    const targetText = graph.getChildren(instance?.id ?? '')[0]
    expect(targetText).toBeDefined()
    const originalOverride = {
      guidPath: { guids: [{ sessionID: 2, localID: 20 }] },
      textData: { characters: 'Stale' },
      opacity: 0.5
    }
    graph.updateNode(instance?.id ?? '', {
      overrides: { [`${targetText?.id}:text`]: 'Edited' },
      source: {
        ...instance?.source,
        fig: {
          ...instance?.source.fig,
          symbolOverrides: [originalOverride]
        }
      }
    })

    const [change] = sceneNodeToKiwi(
      graph.getNode(instance?.id ?? '') ?? instance,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(sourceText.overrideKey).toBe('2:20')
    expect(change.symbolData?.symbolOverrides).toEqual([
      {
        ...originalOverride,
        textData: { characters: 'Edited' }
      }
    ])
  })

  test('injects runtime glyph outlines into derived text data', () => {
    const graph = new SceneGraph()
    const text = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'A',
      width: 20,
      height: 20,
      fontSize: 16
    })
    const blobs: Uint8Array[] = []
    const runtime: FigNodeChangeExportRuntime = {
      getGlyphOutlineMetrics: () => [
        {
          commands: [{ type: 'M', x: 0, y: 0 }, { type: 'L', x: 8, y: 16 }, { type: 'Z' }],
          x: 0,
          advance: 10
        }
      ]
    }

    const [change] = sceneNodeToKiwi(
      text,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      blobs,
      undefined,
      new Map([['Inter|Regular', new Uint8Array([1, 2, 3])]]),
      undefined,
      new Map(),
      undefined,
      undefined,
      runtime
    )

    expect(change.derivedTextData?.glyphs).toHaveLength(1)
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
    expect(change.componentPropDefs?.[0].id).toEqual(
      expect.objectContaining({ sessionID: expect.any(Number), localID: expect.any(Number) })
    )
    expect(change.componentPropDefs?.[0].name).toBe('Style')
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
      nodeIdToGuid,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      propertyIdToGuid
    )
    const slotChange = sceneNodeToKiwi(
      slot,
      componentChange.guid,
      0,
      localIdCounter,
      graph,
      [],
      nodeIdToGuid,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      propertyIdToGuid
    )[0]

    expect(componentChange.componentPropDefs?.[0].id).toEqual(
      slotChange.componentPropRefs?.[0].defID
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
      nodeIdToGuid,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      propertyIdToGuid
    )
    const [buttonChange] = sceneNodeToKiwi(
      button,
      { sessionID: 1, localID: 1 },
      1,
      localIdCounter,
      graph,
      [],
      nodeIdToGuid,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      propertyIdToGuid
    )

    expect(buttonChange.componentPropDefs?.[0].initialValue).toEqual({ guidValue: iconChange.guid })
    expect(buttonChange.componentPropDefs?.[0].preferredValues).toBeUndefined()
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

    expect(buttonChange.componentPropDefs?.[0].preferredValues?.instanceSwapValues).toEqual([
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

    expect(change.componentPropDefs?.[0].initialValue).toEqual({
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

    expect(changes[0].componentPropDefs?.[0].id).toEqual(changes[1].componentPropRefs?.[0].defID)
  })
})
