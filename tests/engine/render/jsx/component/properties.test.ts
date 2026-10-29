import { expect, expectTypeOf, test } from 'bun:test'

import { renderTree } from '@open-pencil/core/design-jsx'
import {
  Component,
  ComponentSet,
  type Frame,
  Instance,
  Text,
  node,
  property,
  type ComponentProperty
} from '@open-pencil/design-jsx'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

test('only instances take property values; layers bind fields to property()', () => {
  expectTypeOf<Parameters<typeof Frame>[0]['properties']>().toEqualTypeOf<undefined>()
  expectTypeOf<Parameters<typeof Text>[0]['properties']>().toEqualTypeOf<undefined>()
  expectTypeOf<Parameters<typeof Component>[0]['properties']>().toEqualTypeOf<undefined>()
  expectTypeOf<Parameters<typeof Instance>[0]['properties']>().toEqualTypeOf<
    | Record<string, string | boolean | number | Record<string, string | boolean | number>>
    | undefined
  >()
  expectTypeOf<Parameters<typeof Text>[0]['text']>().toEqualTypeOf<
    string | ComponentProperty<string> | undefined
  >()
  expectTypeOf<Parameters<typeof Text>[0]['visible']>().toEqualTypeOf<
    boolean | ComponentProperty<boolean> | undefined
  >()
})

async function setup() {
  const graph = makeSceneGraph()
  const component = await renderTree(
    graph,
    Component({
      name: 'Note',
      flex: 'col',
      w: 280,
      h: 'hug',
      children: [
        Text({
          name: 'Duplicate name',
          text: property('Message', 'Default'),
          visible: property('Visible', true),
          w: 'fill',
          color: '#111111'
        }),
        Text({ name: 'Duplicate name', children: 'Unrelated', color: '#111111' })
      ]
    })
  )
  return { graph, component }
}

test('defines a property where a field binds it, typed by that field', async () => {
  const { graph, component } = await setup()
  const definitions = getNodeOrThrow(graph, component.id).componentPropertyDefinitions
  expect(definitions.map(({ name, type, defaultValue }) => ({ name, type, defaultValue }))).toEqual(
    [
      { name: 'Message', type: 'TEXT', defaultValue: 'Default' },
      { name: 'Visible', type: 'BOOLEAN', defaultValue: 'true' }
    ]
  )
  const [text] = graph.getChildren(component.id)
  expect(text.text).toBe('Default')
  expect(text.componentPropertyReferences).toEqual([
    { propertyId: definitions[0].id, field: 'TEXT' },
    { propertyId: definitions[1].id, field: 'VISIBLE' }
  ])
})

test('assigns real text and visibility properties without resolving child names', async () => {
  const { graph, component } = await setup()
  const result = await renderTree(
    graph,
    Instance({ of: component.id, properties: { Message: 'June’s review', Visible: false } })
  )
  const instance = getNodeOrThrow(graph, result.id)
  const children = graph.getChildren(instance.id)
  expect(children.map((child) => child.text)).toEqual(['June’s review', 'Unrelated'])
  expect(children[0].visible).toBe(false)
  expect(Object.values(instance.componentPropertyAssignments)).toEqual(['June’s review', 'false'])
  graph.syncInstances(component.id)
  expect(graph.getChildren(instance.id)[0].text).toBe('June’s review')
  expect(graph.getChildren(instance.id)[0].visible).toBe(false)
  expect(graph.getChildren(component.id)[0].text).toBe('Default')
})

test('variants share the set’s property, and variant selection ignores other props', async () => {
  const graph = makeSceneGraph()
  const set = await renderTree(
    graph,
    ComponentSet({
      name: 'Button',
      children: ['Primary', 'Secondary'].map((variant) =>
        Component({
          name: `variant=${variant}`,
          w: 100,
          h: 40,
          children: Text({ text: property('Message', 'Default') })
        })
      )
    })
  )
  const definitions = getNodeOrThrow(graph, set.id).componentPropertyDefinitions
  expect(definitions.map(({ name, type }) => `${name}:${type}`)).toEqual([
    'Message:TEXT',
    'variant:VARIANT'
  ])
  for (const variant of graph.getChildren(set.id)) {
    expect(variant.componentPropertyDefinitions).toEqual([])
    expect(graph.getChildren(variant.id)[0].componentPropertyReferences).toEqual([
      { propertyId: definitions[0].id, field: 'TEXT' }
    ])
  }

  const result = await renderTree(
    graph,
    Instance({ of: set.id, variant: 'Secondary', w: 120, Message: 'Changed' })
  )
  const instance = getNodeOrThrow(graph, result.id)
  expect(instance.componentId).toBe(graph.getChildren(set.id)[1].id)
  expect(graph.getChildren(instance.id)[0].text).toBe('Changed')
})

test('a property belongs to the nearest component, not an outer one', async () => {
  const graph = makeSceneGraph()
  const outer = await renderTree(
    graph,
    Component({ children: Component({ children: Text({ text: property('Caption', 'Hi') }) }) })
  )
  const [inner] = graph.getChildren(outer.id)
  expect(getNodeOrThrow(graph, outer.id).componentPropertyDefinitions).toEqual([])
  expect(inner.componentPropertyDefinitions.map((item) => item.name)).toEqual(['Caption'])
})

test('one property name with two types or two defaults is an error', async () => {
  const graph = makeSceneGraph()
  const label = (first: Parameters<typeof Text>[0], second: Parameters<typeof Text>[0]) =>
    renderTree(graph, Component({ children: [Text(first), Text(second)] }))
  await expect(
    label({ text: property('Label', 'A') }, { visible: property('Label', true) })
  ).rejects.toThrow('Component property Label is TEXT, not BOOLEAN')
  await expect(
    label({ text: property('Label', 'A') }, { text: property('Label', 'B') })
  ).rejects.toThrow('Component property Label has two defaults: A and B')
})

test('an assignment of the wrong type names the prop and the property', async () => {
  const { graph, component } = await setup()
  await expect(
    // A script can pass any value; the types only describe valid calls.
    renderTree(graph, Instance({ of: component.id, properties: { Message: null } as never }))
  ).rejects.toThrow(
    'Invalid properties on <Instance>:\n× Invalid type: Expected ((string | boolean | number) | Object) but received null\n  → at Message'
  )
})

test('invalid assignments remove the new instance and do not edit its source', async () => {
  const { graph, component } = await setup()
  const count = graph.nodes.size
  const invalidAssignments: Record<string, string>[] = [
    { missing: 'value' },
    { Visible: 'yes' },
    { Message: 'Changed', missing: 'value' }
  ]
  for (const assignments of invalidAssignments) {
    await expect(
      renderTree(graph, Instance({ of: component.id, properties: assignments }))
    ).rejects.toThrow()
    expect(graph.nodes.size).toBe(count)
    expect(graph.getChildren(component.id)[0].text).toBe('Default')
  }
})

test('binds an instance swap through of, its default the component of names', async () => {
  const graph = makeSceneGraph()
  const first = await renderTree(graph, Component({ name: 'First', w: 20, h: 20 }))
  const second = await renderTree(graph, Component({ name: 'Second', w: 30, h: 30 }))
  const component = await renderTree(
    graph,
    Component({ name: 'With slot', children: Instance({ of: property('Slot', 'First') }) })
  )
  expect(getNodeOrThrow(graph, component.id).componentPropertyDefinitions).toMatchObject([
    { name: 'Slot', type: 'INSTANCE_SWAP', defaultValue: first.id }
  ])
  const named = await renderTree(graph, Instance({ of: component.id, Slot: 'Second' }))
  expect(graph.getChildren(named.id)[0].componentId).toBe(second.id)
  const result = await renderTree(graph, Instance({ of: component.id, Slot: second.id }))
  expect(graph.getChildren(result.id)[0].componentId).toBe(second.id)
  graph.syncInstances(component.id)
  expect(graph.getChildren(result.id)[0].componentId).toBe(second.id)
  expect(graph.getChildren(component.id)[0].componentId).toBe(first.id)
})

test('property() binds text, visible, and of, on the layers that have them', async () => {
  const graph = makeSceneGraph()
  const cases: Array<[ReturnType<typeof node>, string]> = [
    [Component({ children: node('frame', { text: property('Label', 'A') }) }), 'needs <Text>'],
    // A script can place a property anywhere; the types only describe valid calls.
    [Component({ children: node('text', { opacity: property('Faded', true) }) }), 'not opacity'],
    [Component({ children: node('text', { visible: property('Shown', 'yes') }) }), 'boolean'],
    [Text({ text: property('Label', 'A') }), 'must be inside a <Component>']
  ]
  for (const [tree, message] of cases) {
    await expect(renderTree(graph, tree)).rejects.toThrow(message)
  }
})

test('elements other than instances reject properties before rendering', async () => {
  const graph = makeSceneGraph()
  for (const type of ['frame', 'text', 'rectangle', 'component', 'component-set']) {
    await expect(renderTree(graph, node(type, { properties: [] }))).rejects.toThrow(
      'Only instances accept properties'
    )
  }
})

/** A Button set with a Label property, and a Card that exposes the Button it holds. */
async function exposedSetup() {
  const graph = makeSceneGraph()
  const button = await renderTree(
    graph,
    ComponentSet({
      name: 'Button',
      children: ['Primary', 'Secondary'].map((variant) =>
        Component({
          name: `Variant=${variant}`,
          children: Text({ text: property('Label', 'OK') })
        })
      )
    })
  )
  const card = await renderTree(
    graph,
    Component({
      name: 'Card',
      children: [
        Text({ text: property('Title', 'Hello') }),
        Instance({ name: 'Action', of: 'Button', exposed: true })
      ]
    })
  )
  return { graph, button, card }
}

test('an exposed instance takes its own properties and variant from the outer instance', async () => {
  const { graph, button, card } = await exposedSetup()
  expect(graph.getChildren(card.id)[1].isExposedInstance).toBe(true)
  for (const tree of [
    Instance({ of: 'Card', Title: 'Welcome', Action: { Label: 'Save', Variant: 'Secondary' } }),
    Instance({
      of: 'Card',
      properties: { Title: 'Welcome', Action: { Label: 'Save', Variant: 'Secondary' } }
    })
  ]) {
    const result = await renderTree(graph, tree)
    const [title, action] = graph.getChildren(result.id)
    expect(title.text).toBe('Welcome')
    expect(action.componentId).toBe(graph.getChildren(button.id)[1].id)
    expect(graph.getChildren(action.id)[0].text).toBe('Save')
    graph.syncInstances(card.id)
    const [, synced] = graph.getChildren(result.id)
    expect(synced.componentId).toBe(graph.getChildren(button.id)[1].id)
    expect(graph.getChildren(synced.id)[0].text).toBe('Save')
  }
})

test('exposing follows Figma’s rules, and unknown exposed values are errors', async () => {
  const { graph } = await exposedSetup()
  await expect(renderTree(graph, Instance({ of: 'Button', exposed: true }))).rejects.toThrow(
    'exposed needs an <Instance> in a component'
  )
  const plain = await renderTree(graph, Component({ name: 'Plain', w: 10, h: 10 }))
  await expect(
    renderTree(graph, Component({ children: Instance({ of: plain.id, exposed: true }) }))
  ).rejects.toThrow('Plain has no properties or exposed instances to expose')
  await expect(
    renderTree(graph, Instance({ of: 'Card', Action: { Missing: 'x' } }))
  ).rejects.toThrow('Unknown component property on Action: Missing')
  await expect(
    renderTree(graph, Instance({ of: 'Card', Action: { Variant: 'Ghost' } }))
  ).rejects.toThrow('Action has no variant Variant=Ghost')
  await expect(
    renderTree(graph, Instance({ of: 'Card', properties: { Other: { Label: 'x' } } }))
  ).rejects.toThrow('Unknown component property or exposed instance: Other')
  await expect(renderTree(graph, Instance({ of: 'Card', Title: { Label: 'x' } }))).rejects.toThrow(
    'Expected a string or boolean for component property: Title'
  )
})
