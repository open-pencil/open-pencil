import { expect, test } from 'bun:test'

import { renderJSX, renderTree } from '@open-pencil/core/design-jsx'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { Component, Instance, Text, property } from '@open-pencil/design-jsx'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type ComponentPropertyDefinition } from '@open-pencil/scene-graph'

const CARD = `
const title = property("Title", "Default title")
const badge = property("Badge", true)
return <ComponentSet name="Card">
  <Component name="state=default">
    <Text text={title} />
    <Text visible={badge}>New</Text>
  </Component>
  <Component name="state=selected">
    <Text text={title} />
    <Text visible={badge}>New</Text>
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

/** A component with property definitions as a file can hold them, IDs and names chosen. */
async function noteWith(graph: SceneGraph, definitions: ComponentPropertyDefinition[]) {
  const component = await renderTree(
    graph,
    Component({ name: 'Note', children: Text({ text: property('Label', 'Label') }) })
  )
  const [text] = graph.getChildren(component.id)
  graph.updateNode(component.id, { componentPropertyDefinitions: definitions })
  graph.updateNode(text.id, {
    componentPropertyReferences: [{ propertyId: definitions[0].id, field: 'TEXT' }]
  })
  return component
}

test('properties prefers an ID; a prop always names the property', async () => {
  const graph = new SceneGraph()
  const component = await noteWith(graph, [
    { id: 'label', name: 'Title', type: 'TEXT', defaultValue: 'Label' },
    { id: 'Title', name: 'Heading', type: 'TEXT', defaultValue: 'Heading' }
  ])
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
  const component = await noteWith(graph, [
    { id: 'a', name: 'Title', type: 'TEXT', defaultValue: 'A' },
    { id: 'b', name: 'Title', type: 'TEXT', defaultValue: 'B' }
  ])
  await expect(renderTree(graph, Instance({ of: component.id, Title: 'Changed' }))).rejects.toThrow(
    'Component property name Title is ambiguous; use one of the IDs: a, b'
  )
})
