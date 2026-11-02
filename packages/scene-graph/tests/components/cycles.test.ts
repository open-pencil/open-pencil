import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  canCreateInstance,
  createsComponentCycle,
  cycleSafeParent
} from '@open-pencil/scene-graph/instances'

/** Card holds a Footer with an Action instance of Button, which holds an instance of Icon. */
function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const icon = graph.createNode('COMPONENT', page, { name: 'Icon' })
  const button = graph.createNode('COMPONENT', page, { name: 'Button' })
  const buttonIcon = graph.createInstance(icon.id, button.id, { name: 'Icon' })
  const card = graph.createNode('COMPONENT', page, { name: 'Card' })
  const footer = graph.createNode('FRAME', card.id, { name: 'Footer' })
  const action = graph.createInstance(button.id, footer.id, { name: 'Action' })
  if (!buttonIcon || !action) throw new Error('instances were not created')
  return { graph, page, icon, button, card, footer, action }
}

describe('instance cycles', () => {
  test('refuses an instance that would contain its own component', () => {
    const { graph, icon, button, card } = setup()
    expect(canCreateInstance(graph, icon.id, card.id)).toBe(true)
    expect(canCreateInstance(graph, card.id, card.id)).toBe(false)
    // Button holds Icon, so Icon cannot hold Button, directly or through a nested layer.
    const frame = graph.createNode('FRAME', icon.id, { name: 'Holder' })
    expect(canCreateInstance(graph, button.id, frame.id)).toBe(false)
  })

  test('counts the component of an instance the new one would sit in', () => {
    const { graph, page, button, card } = setup()
    const outer = graph.createInstance(card.id, page)
    const action = outer && graph.getChildren(outer.id).find((node) => node.name === 'Footer')
    const copy = action && graph.getChildren(action.id).find((node) => node.name === 'Action')
    if (!copy) throw new Error('Expected the Action copy')
    // A layer inside a Button, wherever it is shown, cannot become another Button.
    expect(canCreateInstance(graph, button.id, copy.id)).toBe(false)
    expect(canCreateInstance(graph, card.id, copy.id)).toBe(false)
  })

  test('creating or swapping to an instance that would contain itself does nothing', () => {
    const { graph, icon, button, card, footer, action } = setup()
    const before = graph.nodes.size
    expect(graph.createInstance(card.id, footer.id)).toBeNull()
    expect(graph.createInstance(button.id, icon.id)).toBeNull()
    expect(graph.nodes.size).toBe(before)

    graph.swapInstanceComponent(action.id, card.id)
    expect(action.componentId).toBe(button.id)
    expect(graph.nodes.size).toBe(before)
  })

  test('a layer holding an instance cannot move into that instance’s component', () => {
    const { graph, page, icon, button, card } = setup()
    const holder = graph.createNode('FRAME', page, { name: 'Holder' })
    graph.createInstance(card.id, holder.id)
    const inIcon = graph.createNode('FRAME', icon.id, { name: 'Inside icon' })
    // Card shows a Button, which shows an Icon.
    expect(createsComponentCycle(graph, holder.id, card.id)).toBe(true)
    expect(createsComponentCycle(graph, holder.id, inIcon.id)).toBe(true)
    expect(createsComponentCycle(graph, holder.id, page)).toBe(false)
    expect(createsComponentCycle(graph, inIcon.id, button.id)).toBe(false)
  })

  test('overrides cannot swap in a component that would contain itself', () => {
    const { graph, icon, card, footer } = setup()
    const instance = graph.createInstance(icon.id, footer.id, { componentId: card.id })
    expect(instance?.componentId).toBe(icon.id)
  })

  test('climbing out of a variant passes its set, which holds only variants', () => {
    const { graph, page } = setup()
    const set = graph.createNode('COMPONENT_SET', page, { name: 'States' })
    const variant = graph.createNode('COMPONENT', set.id, { name: 'State=Default' })
    const inner = graph.createNode('FRAME', variant.id, { name: 'Inner' })
    const instance = graph.createInstance(variant.id, page)
    if (!instance) throw new Error('no instance')
    expect(cycleSafeParent(graph, inner.id, [instance.id])).toBe(page)
    expect(cycleSafeParent(graph, set.id, [graph.createNode('COMPONENT', page).id])).toBe(set.id)
  })

  test('the safe parent is the nearest ancestor that can hold every layer', () => {
    const { graph, page, button, card, footer } = setup()
    const outer = graph.createNode('FRAME', page, { name: 'Outer' })
    graph.reparentNode(card.id, outer.id)
    expect(cycleSafeParent(graph, footer.id, [card.id])).toBe(outer.id)
    expect(cycleSafeParent(graph, footer.id, [button.id])).toBe(footer.id)
  })
})
