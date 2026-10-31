import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import {
  hasInstanceOverride,
  setInstanceOverride
} from '@open-pencil/scene-graph/instances/overrides'
import {
  claimSlotContent,
  clearSlotContent,
  ownsSlotContent,
  resetSlotContent,
  slotPropertyId,
  slotScope
} from '@open-pencil/scene-graph/slots'

import { observeWrites } from '../helpers/observe'

/** A component set with a Small and a Large variant, each with a `Content` slot. */
function panel(graph: SceneGraph, page: SceneNode) {
  const set = graph.createNode('COMPONENT_SET', page.id, { name: 'Panel' })
  const variant = (name: string, propertyId: string, slotName = 'Content') => {
    const component = graph.createNode('COMPONENT', set.id, {
      name,
      componentPropertyDefinitions: [
        { id: propertyId, name: slotName, type: 'SLOT', defaultValue: '' }
      ]
    })
    const slot = graph.createNode('FRAME', component.id, {
      name: slotName,
      componentPropertyReferences: [{ propertyId, field: 'SLOT_CONTENT' }]
    })
    graph.createNode('TEXT', slot.id, { name: 'Default', text: 'Default' })
    return component
  }
  return {
    small: variant('Size=Small', 'small:content'),
    large: variant('Size=Large', 'large:content'),
    other: variant('Size=Other', 'other:body', 'Body')
  }
}

function slotChildren(graph: SceneGraph, instance: SceneNode): string[] {
  const slot = graph.getChildren(instance.id).find((child) => slotPropertyId(child))
  return slot ? graph.getChildren(slot.id).map((child) => child.name) : []
}

/** An instance of `component` whose own content replaced the slot's default. */
function filled(graph: SceneGraph, page: SceneNode, component: SceneNode, propertyId: string) {
  const instance = graph.createInstance(component.id, page.id)
  if (!instance) throw new Error('No instance')
  const slot = graph.getChildren(instance.id)[0]
  for (const id of Array.from(slot.childIds)) graph.deleteNode(id)
  graph.createNode('TEXT', slot.id, { name: 'Mine', text: 'Mine' })
  graph.updateNode(instance.id, { componentPropertyAssignments: { [propertyId]: '' } })
  return instance
}

describe('instance slot content', () => {
  test('component sync keeps the content an instance owns', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const { small } = panel(graph, page)
    const owned = filled(graph, page, small, 'small:content')
    const untouched = graph.createInstance(small.id, page.id)
    if (!untouched) throw new Error('No instance')

    const defaultText = graph.getChildren(graph.getChildren(small.id)[0].id)[0]
    graph.updateNode(defaultText.id, { name: 'Edited default' })
    graph.syncInstances(small.id)

    expect(slotChildren(graph, owned)).toEqual(['Mine'])
    expect(slotChildren(graph, untouched)).toEqual(['Edited default'])
  })

  test('a variant switch carries content to the slot of the same name', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const { small, large } = panel(graph, page)
    const instance = filled(graph, page, small, 'small:content')

    graph.swapInstanceComponent(instance.id, large.id)

    expect(slotChildren(graph, instance)).toEqual(['Mine'])
    expect(instance.componentPropertyAssignments).toEqual({ 'large:content': '' })
  })

  test('content without a slot of the same name in the new component is dropped', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const { small, other } = panel(graph, page)
    const instance = filled(graph, page, small, 'small:content')
    const mine = slotChildren(graph, instance)

    graph.swapInstanceComponent(instance.id, other.id)

    expect(mine).toEqual(['Mine'])
    expect(slotChildren(graph, instance)).toEqual(['Default'])
    expect(instance.componentPropertyAssignments).toEqual({})
    expect([...graph.getAllNodes()].filter((node) => node.name === 'Mine')).toEqual([])
  })
})

describe('slot scope', () => {
  function setup() {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const { small } = panel(graph, page)
    const instance = graph.createInstance(small.id, page.id)
    if (!instance) throw new Error('No instance')
    const [slot] = graph.getChildren(instance.id)
    const componentSlot = graph.getChildren(small.id)[0]
    return { graph, page, small, instance, slot, componentSlot }
  }
  const slotOf = (graph: SceneGraph, id: string) => {
    const scope = slotScope(graph, id)
    if (scope.kind !== 'slot') throw new Error(`Expected a slot, got ${scope.kind}`)
    return scope
  }

  test('classifies pages, component slots, instance slots, and the rest of an instance', () => {
    const { graph, page, instance, slot, componentSlot } = setup()
    const nested = graph.createNode('FRAME', slot.id, { name: 'Group' })
    expect(slotScope(graph, page.id).kind).toBe('free')
    expect(slotScope(graph, componentSlot.id).kind).toBe('free')
    expect(slotScope(graph, instance.id).kind).toBe('locked')
    expect(slotOf(graph, slot.id).frame.id).toBe(slot.id)
    expect(slotOf(graph, nested.id).frame.id).toBe(slot.id)
  })

  test('claiming keeps the content but stops it following the component', () => {
    const { graph, small, instance, slot } = setup()
    const [copied] = graph.getChildren(slot.id)
    expect(copied.componentId).not.toBeNull()

    claimSlotContent(graph, slotOf(graph, slot.id))

    expect(ownsSlotContent(graph, slot)).toBe(true)
    expect(graph.getChildren(slot.id).map((child) => child.name)).toEqual(['Default'])
    expect(copied.componentId).toBeNull()
    const defaultText = graph.getChildren(graph.getChildren(small.id)[0].id)[0]
    graph.updateNode(defaultText.id, { name: 'Edited default' })
    graph.syncInstances(small.id)
    expect(graph.getChildren(slot.id).map((child) => child.name)).toEqual(['Default'])
    expect(instance.componentPropertyAssignments).toEqual({ 'small:content': '' })
  })

  test('reset brings back the component content, and clear empties an owned slot', () => {
    const { graph, instance, slot } = setup()
    clearSlotContent(graph, slotOf(graph, slot.id))
    expect(graph.getChildren(slot.id)).toEqual([])
    expect(ownsSlotContent(graph, slot)).toBe(true)

    resetSlotContent(graph, slotOf(graph, slot.id))
    expect(graph.getChildren(slot.id).map((child) => child.name)).toEqual(['Default'])
    expect(instance.componentPropertyAssignments).toEqual({})
    expect(graph.getChildren(slot.id)[0].componentId).not.toBeNull()
  })
})

describe('claiming slot content reports the instance', () => {
  test('before its overrides change, and with an event', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const { small } = panel(graph, page)
    const instance = graph.createInstance(small.id, page.id)
    if (!instance) throw new Error('No instance')
    const slot = graph.getChildren(instance.id)[0]
    const [content] = graph.getChildren(slot.id)
    setInstanceOverride(instance.instanceOverrides, instance.id, content.id, 'name')
    const scope = slotScope(graph, slot.id)
    if (scope.kind !== 'slot') throw new Error(`Expected a slot, got ${scope.kind}`)

    const seen = observeWrites(graph)
    claimSlotContent(graph, scope)
    seen.stop()

    const kept = seen.before.get(instance.id)
    expect(kept && hasInstanceOverride(kept.overrides, instance.id, content.id, 'name')).toBe(true)
    expect(hasInstanceOverride(instance.instanceOverrides, instance.id, content.id, 'name')).toBe(
      false
    )
    expect(seen.touched.has(instance.id)).toBe(true)
  })

  test('a nested instance is reported before it takes over the overrides', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const { small } = panel(graph, page)
    const card = graph.createNode('COMPONENT', page.id, { name: 'Card' })
    graph.createNode('RECTANGLE', card.id, { name: 'Inner' })
    const slotFrame = graph.getChildren(small.id)[0]
    graph.createInstance(card.id, slotFrame.id)
    const instance = graph.createInstance(small.id, page.id)
    if (!instance) throw new Error('No instance')
    const slot = graph.getChildren(instance.id)[0]
    const nested = graph.getChildren(slot.id).find((child) => child.type === 'INSTANCE')
    const inner = nested && graph.getChildren(nested.id)[0]
    if (!nested || !inner) throw new Error('No nested instance')
    setInstanceOverride(instance.instanceOverrides, instance.id, inner.id, 'opacity', 0.5)
    const scope = slotScope(graph, slot.id)
    if (scope.kind !== 'slot') throw new Error(`Expected a slot, got ${scope.kind}`)

    const seen = observeWrites(graph)
    claimSlotContent(graph, scope)
    seen.stop()

    const kept = seen.before.get(nested.id)
    expect(kept && hasInstanceOverride(kept.overrides, nested.id, inner.id, 'opacity')).toBe(false)
    expect(hasInstanceOverride(nested.instanceOverrides, nested.id, inner.id, 'opacity')).toBe(true)
    expect(seen.touched.has(nested.id)).toBe(true)
  })
})
