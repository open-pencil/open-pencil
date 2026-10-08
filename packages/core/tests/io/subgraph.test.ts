import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { extractPageContext } from '#core/io/subgraph'

/** A Switch set with two variants, and a card on the same page holding an Off instance. */
function cardWithSwitch() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const set = graph.createNode('COMPONENT_SET', pageId, { name: 'Switch' })
  const off = graph.createNode('COMPONENT', set.id, { name: 'State=Off' })
  const on = graph.createNode('COMPONENT', set.id, { name: 'State=On' })
  const card = graph.createNode('FRAME', pageId, { name: 'Card' })
  const instance = graph.createInstance(off.id, card.id)
  if (!instance) throw new Error('No instance')
  return { graph, pageId, card, instance, off, on }
}

describe('extracting page context', () => {
  test("brings an instance's main component, or its whole set when asked", () => {
    const { graph, pageId, card, off, on } = cardWithSwitch()
    const plain = extractPageContext(graph, pageId, [card.id])
    expect(plain.getNode(off.id)).toBeDefined()
    expect(plain.getNode(on.id)).toBeUndefined()
    const withSets = extractPageContext(graph, pageId, [card.id], { componentSets: true })
    expect(withSets.getNode(on.id)).toBeDefined()
  })

  test('indexes instances by component, so the copy can sync and swap them', () => {
    const { graph, pageId, card, instance, off } = cardWithSwitch()
    const copy = extractPageContext(graph, pageId, [card.id], { componentSets: true })
    expect([...(copy.instanceIndex.get(off.id) ?? [])]).toEqual([instance.id])
  })

  test("copies the source's tables, or shares them for a read-only view", () => {
    const { graph, pageId, card } = cardWithSwitch()
    expect(extractPageContext(graph, pageId, [card.id]).variables).not.toBe(graph.variables)
    const shared = extractPageContext(graph, pageId, [card.id], { shareTables: true })
    expect(shared.variables).toBe(graph.variables)
    expect(shared.images).toBe(graph.images)
  })
})
