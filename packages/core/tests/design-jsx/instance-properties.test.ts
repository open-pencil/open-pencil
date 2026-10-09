import { expect, test } from 'bun:test'

import { renderTree } from '@open-pencil/core/design-jsx'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { Component, ComponentSet, Instance, Text } from '@open-pencil/design-jsx'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

function card(id = 'title') {
  return ComponentSet({
    name: 'Card',
    properties: [{ id, name: 'Title', type: 'TEXT', defaultValue: 'Default title' }],
    children: ['default', 'selected'].map((state) =>
      Component({
        name: `state=${state}`,
        children: Text({
          name: 'Title',
          children: 'Default title',
          propertyRefs: [{ propertyId: id, field: 'TEXT' }]
        })
      })
    )
  })
}

function componentSet(graph: SceneGraph): SceneNode {
  const set = [...graph.getAllNodes()].find((node) => node.type === 'COMPONENT_SET')
  if (!set) throw new Error('Missing component set')
  return set
}

async function titleOf(graph: SceneGraph, properties: Record<string, string>) {
  const instance = await renderTree(
    graph,
    Instance({ of: componentSet(graph).id, state: 'selected', properties })
  )
  return graph.getChildren(instance.id)[0]?.text
}

test('assigns a property by its authored ID after the document is saved and reopened', async () => {
  await initCodec()
  const graph = new SceneGraph()
  await renderTree(graph, card())
  const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer, {
    populate: 'first-page'
  })
  const [definition] = componentSet(reopened).componentPropertyDefinitions
  expect(definition.id).not.toBe('title')

  expect(await titleOf(reopened, { title: 'Override via properties' })).toBe(
    'Override via properties'
  )
  expect(await titleOf(reopened, { [definition.id]: 'By ID' })).toBe('By ID')
})

test('prefers a property ID over another property with that name', async () => {
  const graph = new SceneGraph()
  await renderTree(
    graph,
    Component({
      name: 'Note',
      properties: [
        { id: 'label', name: 'Title', type: 'TEXT', defaultValue: 'Label' },
        { id: 'title', name: 'Heading', type: 'TEXT', defaultValue: 'Heading' }
      ],
      children: Text({
        children: 'Label',
        propertyRefs: [{ propertyId: 'label', field: 'TEXT' }]
      })
    })
  )
  const component = [...graph.getAllNodes()].find((node) => node.type === 'COMPONENT')
  if (!component) throw new Error('Missing component')
  const instance = await renderTree(
    graph,
    Instance({ of: component.id, properties: { title: 'Changed' } })
  )
  expect(graph.getChildren(instance.id)[0]?.text).toBe('Label')
  expect(graph.getNode(instance.id)?.componentPropertyAssignments).toEqual({ title: 'Changed' })
})

test('rejects a property name that more than one property has', async () => {
  const graph = new SceneGraph()
  await renderTree(
    graph,
    Component({
      name: 'Note',
      properties: [
        { id: 'a', name: 'Title', type: 'TEXT', defaultValue: 'A' },
        { id: 'b', name: 'title', type: 'TEXT', defaultValue: 'B' }
      ]
    })
  )
  const component = [...graph.getAllNodes()].find((node) => node.type === 'COMPONENT')
  if (!component) throw new Error('Missing component')
  await expect(
    renderTree(graph, Instance({ of: component.id, properties: { TITLE: 'Changed' } }))
  ).rejects.toThrow('Component property name TITLE is ambiguous; use one of the IDs: a, b')
})
