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
        initialValue: { textValue: { characters: 'Enabled' } }
      }
    ])
    expect(kiwi.variantPropSpecs).toEqual([
      { propDefId: { sessionID: 90, localID: 1 }, value: 'Enabled' }
    ])
  })
})
