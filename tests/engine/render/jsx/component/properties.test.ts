import { expect, expectTypeOf, test } from 'bun:test'

import { renderTree } from '@open-pencil/core/design-jsx'
import { Component, ComponentSet, type Frame, Instance, Text, node } from '@open-pencil/design-jsx'
import type { ComponentPropertyDefinition, SceneNode } from '@open-pencil/scene-graph'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

test('property props are scoped to their authoring entities', () => {
  expectTypeOf<Parameters<typeof Frame>[0]['properties']>().toEqualTypeOf<undefined>()
  expectTypeOf<Parameters<typeof Text>[0]['properties']>().toEqualTypeOf<undefined>()
  expectTypeOf<Parameters<typeof Component>[0]['properties']>().toEqualTypeOf<
    SceneNode['componentPropertyDefinitions'] | undefined
  >()
  expectTypeOf<Parameters<typeof Instance>[0]['properties']>().toEqualTypeOf<
    SceneNode['componentPropertyAssignments'] | undefined
  >()
})

const MESSAGE: ComponentPropertyDefinition = {
  id: 'message',
  name: 'Message',
  type: 'TEXT',
  defaultValue: 'Default'
}
const VISIBLE: ComponentPropertyDefinition = {
  id: 'visible',
  name: 'Visible',
  type: 'BOOLEAN',
  defaultValue: 'true'
}

async function setup() {
  const graph = makeSceneGraph()
  const component = await renderTree(
    graph,
    Component({
      name: 'Note',
      flex: 'col',
      w: 280,
      h: 'hug',
      properties: [MESSAGE, VISIBLE],
      children: [
        Text({
          name: 'Duplicate name',
          children: 'Default',
          w: 'fill',
          color: '#111111',
          propertyRefs: [
            { propertyId: MESSAGE.id, field: 'TEXT' },
            { propertyId: VISIBLE.id, field: 'VISIBLE' }
          ]
        }),
        Text({ name: 'Duplicate name', children: 'Unrelated', color: '#111111' })
      ]
    })
  )
  return { graph, component }
}

test('assigns real text and visibility properties without resolving child names', async () => {
  const { graph, component } = await setup()
  const result = await renderTree(
    graph,
    Instance({ of: component.id, properties: { message: 'June’s review', visible: 'false' } })
  )
  const instance = getNodeOrThrow(graph, result.id)
  const children = graph.getChildren(instance.id)
  expect(children.map((child) => child.text)).toEqual(['June’s review', 'Unrelated'])
  expect(children[0].visible).toBe(false)
  expect(instance.componentPropertyAssignments).toEqual({
    message: 'June’s review',
    visible: 'false'
  })
  graph.syncInstances(component.id)
  expect(graph.getChildren(instance.id)[0].text).toBe('June’s review')
  expect(graph.getChildren(instance.id)[0].visible).toBe(false)
  expect(graph.getChildren(component.id)[0].text).toBe('Default')
})

test('variant selection ignores non-variant instance props', async () => {
  const graph = makeSceneGraph()
  const set = await renderTree(
    graph,
    ComponentSet({
      name: 'Button',
      children: [
        Component({ name: 'variant=Primary', w: 100, h: 40 }),
        Component({
          name: 'variant=Secondary',
          w: 100,
          h: 40,
          properties: [MESSAGE],
          children: Text({
            children: 'Default',
            propertyRefs: [{ propertyId: MESSAGE.id, field: 'TEXT' }]
          })
        })
      ]
    })
  )
  const result = await renderTree(
    graph,
    Instance({ of: set.id, variant: 'Secondary', w: 120, properties: { message: 'Changed' } })
  )
  const instance = getNodeOrThrow(graph, result.id)
  expect(instance.componentId).toBe(graph.getChildren(set.id)[1].id)
  expect(graph.getChildren(instance.id)[0].text).toBe('Changed')
})

test('an assignment of the wrong type names the prop and the property', async () => {
  const { graph, component } = await setup()
  await expect(
    // A script can pass any value; the types only describe valid calls.
    renderTree(graph, Instance({ of: component.id, properties: { message: 42 } as never }))
  ).rejects.toThrow(
    'Invalid properties on <Instance>:\n× Invalid type: Expected string but received 42\n  → at message'
  )
})

test('invalid assignments remove the new instance and do not edit its source', async () => {
  const { graph, component } = await setup()
  const count = graph.nodes.size
  const invalidAssignments: Record<string, string>[] = [
    { missing: 'value' },
    { visible: 'yes' },
    { message: 'Changed', missing: 'value' }
  ]
  for (const assignments of invalidAssignments) {
    await expect(
      renderTree(graph, Instance({ of: component.id, properties: assignments }))
    ).rejects.toThrow()
    expect(graph.nodes.size).toBe(count)
    expect(graph.getChildren(component.id)[0].text).toBe('Default')
  }
})

test('assigns nested instance swaps through stable property references', async () => {
  const graph = makeSceneGraph()
  const first = await renderTree(graph, Component({ name: 'First', w: 20, h: 20 }))
  const second = await renderTree(graph, Component({ name: 'Second', w: 30, h: 30 }))
  const component = await renderTree(
    graph,
    Component({
      name: 'With slot',
      properties: [{ id: 'slot', name: 'Slot', type: 'INSTANCE_SWAP', defaultValue: first.id }],
      children: Instance({
        of: first.id,
        propertyRefs: [{ propertyId: 'slot', field: 'INSTANCE_SWAP' }]
      })
    })
  )
  const result = await renderTree(
    graph,
    Instance({ of: component.id, properties: { slot: second.id } })
  )
  expect(graph.getChildren(result.id)[0].componentId).toBe(second.id)
  graph.syncInstances(component.id)
  expect(graph.getChildren(result.id)[0].componentId).toBe(second.id)
  expect(graph.getChildren(component.id)[0].componentId).toBe(first.id)
})

test('ordinary elements reject properties before rendering', async () => {
  const graph = makeSceneGraph()
  for (const type of ['frame', 'text', 'rectangle', 'icon', 'svg']) {
    await expect(renderTree(graph, node(type, { properties: [MESSAGE] }))).rejects.toThrow(
      'Only components'
    )
  }
})

test('validates metadata rather than accepting silent malformed property definitions', async () => {
  const graph = makeSceneGraph()
  await expect(renderTree(graph, node('text', { properties: [MESSAGE] }))).rejects.toThrow(
    'Only components'
  )
  await expect(renderTree(graph, Component({ properties: [MESSAGE, MESSAGE] }))).rejects.toThrow(
    'Duplicate'
  )
  for (const element of [Component, ComponentSet]) {
    await expect(
      renderTree(
        graph,
        element({
          properties: [
            { id: 'kind-a', name: 'Kind', type: 'VARIANT', defaultValue: 'A' },
            { id: 'kind-b', name: 'Kind', type: 'VARIANT', defaultValue: 'B' }
          ]
        })
      )
    ).rejects.toThrow('Duplicate variant property names')
  }
})

test('preserves duplicate display names for non-variant properties with distinct IDs', async () => {
  const graph = makeSceneGraph()
  const result = await renderTree(
    graph,
    Component({ properties: [MESSAGE, { ...MESSAGE, id: 'other-message' }] })
  )
  expect(
    getNodeOrThrow(graph, result.id).componentPropertyDefinitions.map((item) => item.id)
  ).toEqual(['message', 'other-message'])
})
