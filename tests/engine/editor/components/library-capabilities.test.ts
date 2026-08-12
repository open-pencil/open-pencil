import { describe, expect, test } from 'bun:test'

import {
  assertNodeEditable,
  getNodeEditCapability,
  ReadOnlyLibraryDefinitionError
} from '@open-pencil/core/editor'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { updateNode } from '@open-pencil/core/tools/modify'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('library definition capabilities', () => {
  test('protects materialized definitions and descendants but not their instances', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      name: 'Remote button',
      librarySource: {
        identity: { libraryId: 'design-system', assetKey: 'button', revisionId: 'r1' },
        sourceNodeId: 'source',
        readOnly: true
      }
    })
    const child = graph.createNode('TEXT', component.id, { name: 'Label', text: 'Button' })
    const instance = graph.createInstance(component.id, page.id)
    if (!instance) throw new Error('Expected instance')

    expect(getNodeEditCapability(graph, child.id)).toEqual({
      editable: false,
      reason: 'library-definition',
      libraryId: 'design-system',
      assetKey: 'button'
    })
    expect(getNodeEditCapability(graph, instance.id)).toEqual({ editable: true })
    expect(() => assertNodeEditable(graph, child.id)).toThrow(ReadOnlyLibraryDefinitionError)

    const figma = new FigmaAPI(graph)
    const proxy = figma.getNodeById(component.id)
    if (!proxy) throw new Error('Expected proxy')
    expect(() => {
      proxy.name = 'Changed'
    }).toThrow(ReadOnlyLibraryDefinitionError)
    expect(() => {
      proxy.opacity = 0.5
    }).toThrow(ReadOnlyLibraryDefinitionError)
    expect(() => proxy.remove()).toThrow(ReadOnlyLibraryDefinitionError)
    expect(graph.getNode(component.id)?.name).toBe('Remote button')
    const instanceProxy = figma.getNodeById(instance.id)
    if (!instanceProxy) throw new Error('Expected instance proxy')
    instanceProxy.opacity = 0.5
    expect(graph.getNode(instance.id)?.opacity).toBe(0.5)
    expect(() => updateNode.execute(figma, { id: component.id, opacity: 0.5 })).toThrow(
      ReadOnlyLibraryDefinitionError
    )
  })
})
