import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

import { pageId, toKiwi } from './helpers'

describe('component metadata serialization', () => {
  test('writes verified Figma component metadata fields', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('COMPONENT_SET', pageId(graph), {
      name: 'Button',
      componentKey: 'component-key',
      sourceLibraryKey: 'lk-source',
      publishId: '12:34',
      overrideKey: '56:78',
      sharedSymbolVersion: '100:200',
      publishedVersion: '300:400',
      isPublishable: true,
      isSymbolPublishable: true,
      symbolDescription: 'Button docs',
      symbolLinks: [{ uri: 'https://example.com/docs', displayName: 'Docs' }],
      componentPropertyDefinitions: [
        {
          id: '90:1',
          name: 'State',
          type: 'VARIANT',
          defaultValue: 'Enabled',
          variantOptions: ['Enabled']
        }
      ],
      variantPropSpecs: [{ propDefId: '90:1', value: 'Enabled' }]
    })

    const [kiwi] = toKiwi(node, graph)
    expect(kiwi.componentKey).toBe('component-key')
    expect(kiwi.sourceLibraryKey).toBe('lk-source')
    expect(kiwi.publishID).toEqual({ sessionID: 12, localID: 34 })
    expect(kiwi.overrideKey).toEqual({ sessionID: 56, localID: 78 })
    expect(kiwi.sharedSymbolVersion).toBe('100:200')
    expect(kiwi.publishedVersion).toBe('300:400')
    expect(kiwi.isPublishable).toBe(true)
    expect(kiwi.isSymbolPublishable).toBe(true)
    expect(kiwi.symbolDescription).toBe('Button docs')
    expect(kiwi.symbolLinks).toEqual([{ uri: 'https://example.com/docs', displayName: 'Docs' }])
    expect(kiwi.componentPropDefs).toEqual([
      {
        id: { sessionID: 90, localID: 1 },
        name: 'State',
        type: 'VARIANT',
        initialValue: { textValue: { characters: 'Enabled' } },
        varValue: {
          dataType: 'STRING',
          resolvedDataType: 'STRING',
          value: { textValue: 'Enabled' }
        },
        preferredValues: { stringValues: ['Enabled'] }
      }
    ])
    expect(kiwi.variantPropSpecs).toEqual([
      { propDefId: { sessionID: 90, localID: 1 }, value: 'Enabled' }
    ])
  })

  test('writes typed component property refs and assignments', () => {
    const graph = new SceneGraph()
    const target = graph.createNode('COMPONENT', pageId(graph), { name: 'Target icon' })
    target.source.id = '70:1'
    const component = graph.createNode('COMPONENT', pageId(graph), {
      name: 'Card',
      componentPropertyDefinitions: [
        { id: '80:1', name: 'Visible', type: 'BOOLEAN', defaultValue: 'true' },
        { id: '80:2', name: 'Label', type: 'TEXT', defaultValue: 'Default' },
        {
          id: '80:3',
          name: 'Icon',
          type: 'INSTANCE_SWAP',
          defaultValue: target.id,
          preferredValues: ['icon-key']
        }
      ]
    })
    const child = graph.createNode('TEXT', component.id, {
      componentPropertyReferences: [
        { propertyId: '80:1', field: 'VISIBLE' },
        { propertyId: '80:2', field: 'TEXT' }
      ]
    })
    const instance = graph.createNode('INSTANCE', pageId(graph), {
      componentId: component.id,
      componentPropertyAssignments: {
        '80:1': 'false',
        '80:2': 'Changed',
        '80:3': target.id
      }
    })

    const childKiwi = toKiwi(child, graph)[0]
    expect(childKiwi.componentPropRefs).toEqual([
      { defID: { sessionID: 80, localID: 1 }, componentPropNodeField: 'VISIBLE' },
      { defID: { sessionID: 80, localID: 2 }, componentPropNodeField: 'TEXT_DATA' }
    ])

    const instanceKiwi = toKiwi(instance, graph)[0]
    expect(instanceKiwi.componentPropAssignments).toEqual([
      {
        defID: { sessionID: 80, localID: 1 },
        value: { boolValue: false },
        varValue: { dataType: 'BOOLEAN', resolvedDataType: 'BOOLEAN', value: { boolValue: false } }
      },
      {
        defID: { sessionID: 80, localID: 2 },
        value: { textValue: { characters: 'Changed' } },
        varValue: {
          dataType: 'STRING',
          resolvedDataType: 'STRING',
          value: { textValue: 'Changed' }
        }
      },
      {
        defID: { sessionID: 80, localID: 3 },
        value: { guidValue: { sessionID: 70, localID: 1 } },
        varValue: {
          dataType: 'SYMBOL_ID',
          resolvedDataType: 'SYMBOL_ID',
          value: { symbolIdValue: { guid: { sessionID: 70, localID: 1 } } }
        }
      }
    ])
  })
})
