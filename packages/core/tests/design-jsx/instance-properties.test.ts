import { expect, test } from 'bun:test'

import { renderJSX, renderTree } from '@open-pencil/core/design-jsx'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { Component, Instance, Text } from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

const CARD = `
<ComponentSet name="Card" properties={[
  { id: "title", name: "Title", type: "TEXT", defaultValue: "Default title" },
  { id: "badge", name: "Badge", type: "BOOLEAN", defaultValue: "true" }
]}>
  <Component name="state=default">
    <Text propertyRefs={[{ propertyId: "title", field: "TEXT" }]}>Default title</Text>
    <Text propertyRefs={[{ propertyId: "badge", field: "VISIBLE" }]}>New</Text>
  </Component>
  <Component name="state=selected">
    <Text propertyRefs={[{ propertyId: "title", field: "TEXT" }]}>Default title</Text>
    <Text propertyRefs={[{ propertyId: "badge", field: "VISIBLE" }]}>New</Text>
  </Component>
</ComponentSet>`

async function reopenedCard(): Promise<SceneGraph> {
  await initCodec()
  const graph = new SceneGraph()
  await renderJSX(graph, CARD)
  return parseFigFile((await exportFigFile(graph)).slice().buffer, { populate: 'first-page' })
}

function layers(graph: SceneGraph, instance: { id: string }) {
  return graph.getChildren(instance.id).map((child) => [child.text, child.visible])
}

test('sets component properties by name, like variants, after a .fig reload', async () => {
  const graph = await reopenedCard()
  const [instance] = await renderJSX(
    graph,
    `<Instance of="Card" state="selected" Title="Hello" Badge={false} />`
  )
  expect(instance.warnings).toBeUndefined()
  expect(graph.getNode(instance.id)?.name).toBe('state=selected')
  expect(layers(graph, instance)).toEqual([
    ['Hello', true],
    ['New', false]
  ])
})

test('assigns properties by ID or by name', async () => {
  const graph = await reopenedCard()
  const set = [...graph.getAllNodes()].find((node) => node.type === 'COMPONENT_SET')
  const title = set?.componentPropertyDefinitions.find((item) => item.name === 'Title')
  if (!title) throw new Error('Missing Title property')
  expect(title.id).not.toBe('title')

  for (const key of [title.id, 'Title']) {
    const [instance] = await renderJSX(
      graph,
      `<Instance of="Card" properties={{ ${JSON.stringify(key)}: "By ${key}" }} />`
    )
    expect(layers(graph, instance)[0]).toEqual([`By ${key}`, true])
  }
  await expect(
    renderJSX(graph, `<Instance of="Card" properties={{ title: "Hello" }} />`)
  ).rejects.toThrow('Unknown component property: title')
})

test('properties prefers an ID; a prop always names the property', async () => {
  const graph = new SceneGraph()
  const component = await renderTree(
    graph,
    Component({
      name: 'Note',
      properties: [
        { id: 'label', name: 'Title', type: 'TEXT', defaultValue: 'Label' },
        { id: 'Title', name: 'Heading', type: 'TEXT', defaultValue: 'Heading' }
      ],
      children: Text({
        children: 'Label',
        propertyRefs: [{ propertyId: 'label', field: 'TEXT' }]
      })
    })
  )
  const instance = await renderTree(
    graph,
    Instance({ of: component.id, properties: { Title: 'Changed' } })
  )
  expect(graph.getChildren(instance.id)[0]?.text).toBe('Label')
  expect(graph.getNode(instance.id)?.componentPropertyAssignments).toEqual({ Title: 'Changed' })

  const named = await renderTree(graph, Instance({ of: component.id, Title: 'By name' }))
  expect(graph.getChildren(named.id)[0]?.text).toBe('By name')
  expect(graph.getNode(named.id)?.componentPropertyAssignments).toEqual({ label: 'By name' })
})

test('rejects a property name that more than one property has', async () => {
  const graph = new SceneGraph()
  const component = await renderTree(
    graph,
    Component({
      name: 'Note',
      properties: [
        { id: 'a', name: 'Title', type: 'TEXT', defaultValue: 'A' },
        { id: 'b', name: 'Title', type: 'TEXT', defaultValue: 'B' }
      ]
    })
  )
  await expect(renderTree(graph, Instance({ of: component.id, Title: 'Changed' }))).rejects.toThrow(
    'Component property name Title is ambiguous; use one of the IDs: a, b'
  )
})
