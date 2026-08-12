import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec } from '@open-pencil/core'
import { parseFigBuffer } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

import { importNodeChanges } from '#core/kiwi/fig/import'

describe('Figma component property roundtrip', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('retains OpenPencil library bindings and materialized identity', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.enabledLibraries.set('design-system', {
      libraryId: 'design-system',
      revisionId: 'revision-1',
      enabled: true
    })
    const component = graph.createNode('COMPONENT', page.id, {
      name: 'Remote button',
      componentKey: 'button',
      librarySource: {
        identity: {
          libraryId: 'design-system',
          assetKey: 'button',
          revisionId: 'revision-1'
        },
        sourceNodeId: 'source-button',
        readOnly: true
      }
    })
    component.source.id = '50:1'

    const bytes = await exportFigFile(graph)
    const parsed = parseFigBuffer(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const imported = importNodeChanges(parsed.nodeChanges, parsed.blobs, undefined, {
      populate: 'all'
    })
    expect(imported.enabledLibraries.get('design-system')).toEqual({
      libraryId: 'design-system',
      revisionId: 'revision-1',
      enabled: true
    })
    expect(
      [...imported.getAllNodes()].find((node) => node.name === 'Remote button')?.librarySource
    ).toEqual(component.librarySource)
  })

  test('retains authored multidimensional variant definitions and combinations', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const componentSet = graph.createNode('COMPONENT_SET', page.id, {
      name: 'Button',
      componentPropertyDefinitions: [
        {
          id: '40:1',
          name: 'Type',
          type: 'VARIANT',
          defaultValue: 'Primary',
          variantOptions: ['Primary', 'Secondary']
        },
        {
          id: '40:2',
          name: 'Size',
          type: 'VARIANT',
          defaultValue: 'Small',
          variantOptions: ['Small', 'Large']
        },
        {
          id: '40:3',
          name: 'State',
          type: 'VARIANT',
          defaultValue: 'Enabled',
          variantOptions: ['Enabled', 'Disabled']
        }
      ]
    })
    componentSet.source.id = '40:0'
    const combinations = [
      { Type: 'Primary', Size: 'Small', State: 'Enabled' },
      { Type: 'Primary', Size: 'Large', State: 'Enabled' },
      { Type: 'Secondary', Size: 'Small', State: 'Disabled' }
    ]
    for (const [index, values] of combinations.entries()) {
      const variant = graph.createNode('COMPONENT', componentSet.id, {
        name: Object.entries(values)
          .map(([name, value]) => `${name}=${value}`)
          .join(', '),
        componentPropertyValues: values
      })
      variant.source.id = `40:${index + 10}`
    }

    const bytes = await exportFigFile(graph)
    const parsed = parseFigBuffer(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const imported = importNodeChanges(parsed.nodeChanges, parsed.blobs, undefined, {
      populate: 'all'
    })
    const importedSet = [...imported.getAllNodes()].find(
      (node) => node.type === 'COMPONENT_SET' && node.name === 'Button'
    )
    if (!importedSet) throw new Error('Expected imported component set')

    expect(importedSet.componentPropertyDefinitions).toEqual(
      componentSet.componentPropertyDefinitions
    )
    expect(importedSet.childIds.map((id) => imported.getNode(id)?.componentPropertyValues)).toEqual(
      combinations
    )
  })

  test('retains typed definitions, refs, and assignments', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      name: 'Card',
      componentPropertyDefinitions: [
        { id: '30:1', name: 'Label', type: 'TEXT', defaultValue: 'Default' },
        { id: '30:2', name: 'Visible', type: 'BOOLEAN', defaultValue: 'true' }
      ]
    })
    component.source.id = '10:1'
    const label = graph.createNode('TEXT', component.id, {
      name: 'Label',
      text: 'Default',
      componentPropertyReferences: [
        { propertyId: '30:1', field: 'TEXT' },
        { propertyId: '30:2', field: 'VISIBLE' }
      ]
    })
    label.source.id = '10:2'
    const instance = graph.createInstance(component.id, page.id, {
      name: 'Card instance',
      componentPropertyAssignments: { '30:1': 'Custom', '30:2': 'false' }
    })
    if (!instance) throw new Error('Expected instance')
    instance.source.id = '20:1'

    const bytes = await exportFigFile(graph)
    const parsed = parseFigBuffer(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const imported = importNodeChanges(parsed.nodeChanges, parsed.blobs, undefined, {
      populate: 'all'
    })
    const importedComponent = [...imported.getAllNodes()].find((node) => node.name === 'Card')
    const importedInstance = [...imported.getAllNodes()].find(
      (node) => node.name === 'Card instance'
    )
    const importedLabel = [...imported.getAllNodes()].find(
      (node) => node.name === 'Label' && node.parentId === importedComponent?.id
    )

    expect(importedComponent?.componentPropertyDefinitions).toEqual([
      { id: '30:1', name: 'Label', type: 'TEXT', defaultValue: 'Default' },
      { id: '30:2', name: 'Visible', type: 'BOOLEAN', defaultValue: 'true' }
    ])
    expect(importedLabel?.componentPropertyReferences).toEqual([
      { propertyId: '30:1', field: 'TEXT' },
      { propertyId: '30:2', field: 'VISIBLE' }
    ])
    expect(importedInstance?.componentPropertyAssignments).toEqual({
      '30:1': 'Custom',
      '30:2': 'false'
    })
  })
})
