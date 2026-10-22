import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { FigmaAPI, type FigmaInstanceNode } from '@open-pencil/core/figma-api'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { applyComponentPropertyValue } from '@open-pencil/scene-graph/components'

function dialogWithCaption() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const label = graph.createNode('COMPONENT', page, {
    name: 'Label',
    x: 900,
    componentPropertyDefinitions: [
      { id: '5:1', name: 'Text', type: 'TEXT', defaultValue: 'Text' },
      { id: '5:2', name: 'Hint', type: 'TEXT', defaultValue: 'Hint' }
    ]
  })
  for (const definition of label.componentPropertyDefinitions) {
    graph.createNode('TEXT', label.id, {
      name: definition.name,
      text: definition.defaultValue,
      componentPropertyReferences: [{ field: 'TEXT', propertyId: definition.id }]
    })
  }
  const set = graph.createNode('COMPONENT_SET', page, {
    name: 'Dialog',
    componentPropertyDefinitions: [{ id: '6:1', name: 'Kind', type: 'VARIANT', defaultValue: 'Ok' }]
  })
  const variant = (kind: string, y: number) => {
    const component = graph.createNode('COMPONENT', set.id, {
      name: `Kind=${kind}`,
      y,
      componentPropertyValues: { Kind: kind }
    })
    const nested = expectDefined(graph.createInstance(label.id, component.id, { name: 'Label' }))
    for (const definition of label.componentPropertyDefinitions) {
      applyComponentPropertyValue(graph, nested.id, definition, `${kind} ${definition.name}`)
    }
    return component
  }
  const ok = variant('Ok', 0)
  variant('Cancel', 100)
  const dialog = expectDefined(graph.createInstance(ok.id, page, { x: 500, name: 'Placed dialog' }))
  const nested = expectDefined(graph.getChildren(dialog.id)[0])
  return { graph, nested }
}

function instanceProxy(graph: SceneGraph, id: string) {
  return new FigmaAPI(graph).wrapNode(id) as FigmaInstanceNode
}

async function captionsAfterReopenAndSwitch(graph: SceneGraph): Promise<string[]> {
  const reopened = await parseFigFile(Uint8Array.from(await exportFigFile(graph)).buffer)
  const nodes = [...reopened.getAllNodes()]
  const placed = expectDefined(nodes.find((node) => node.name === 'Placed dialog'))
  const cancel = expectDefined(nodes.find((node) => node.name === 'Kind=Cancel'))
  reopened.swapInstanceComponent(placed.id, cancel.id)
  const label = expectDefined(reopened.getChildren(placed.id)[0])
  return reopened.getChildren(label.id).map((caption) => caption.text)
}

test('a property value set on a nested instance stays its own after export and reopen', async () => {
  await initCodec()
  const { graph, nested } = dialogWithCaption()
  instanceProxy(graph, nested.id).setProperties({ 'Text#5:1': 'Custom' })

  expect(await captionsAfterReopenAndSwitch(graph)).toEqual(['Custom', 'Cancel Hint'])
})

test('several property values set on one nested instance all stay its own', async () => {
  await initCodec()
  const { graph, nested } = dialogWithCaption()
  instanceProxy(graph, nested.id).setProperties({ 'Text#5:1': 'Custom', 'Hint#5:2': 'Mine' })

  expect(await captionsAfterReopenAndSwitch(graph)).toEqual(['Custom', 'Mine'])
})
