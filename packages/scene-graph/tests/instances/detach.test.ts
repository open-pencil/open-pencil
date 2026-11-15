import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { hasInstanceOverride, recordInstanceOverride } from '@open-pencil/scene-graph/instances'

/** A card whose tag's label the card's component overrides, and an instance of the card. */
function cardInstance() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const tag = graph.createNode('COMPONENT', pageId, { name: 'Tag' })
  graph.createNode('TEXT', tag.id, { name: 'Label', text: 'Tag' })
  const card = graph.createNode('COMPONENT', pageId, { name: 'Card' })
  const nested = graph.createInstance(tag.id, card.id)
  if (!nested) throw new Error('No nested tag')
  const [nestedLabel] = graph.getChildren(nested.id)
  graph.updateNode(nestedLabel.id, { text: 'Práctica guiada' })
  recordInstanceOverride(graph, nestedLabel.id, ['text'])
  const instance = graph.createInstance(card.id, pageId)
  if (!instance) throw new Error('No instance')
  const [tagCopy] = graph.getChildren(instance.id)
  const [label] = graph.getChildren(tagCopy.id)
  return { graph, pageId, instance, tagCopy, label }
}

describe('detaching an instance', () => {
  test('gives a nested instance its component’s overrides under its own layers', () => {
    const { graph, instance, tagCopy, label } = cardInstance()

    graph.detachInstance(instance.id)

    expect(hasInstanceOverride(graph, label.id, 'text')).toBe(true)
    expect([...tagCopy.instanceOverrides.descendants.keys()]).toEqual([label.id])
    expect(label.text).toBe('Práctica guiada')
  })

  test('keeps what was changed on a nested layer before detaching', () => {
    const { graph, instance, tagCopy, label } = cardInstance()
    graph.updateNode(label.id, { text: 'Práctica libre', fontSize: 18 })
    recordInstanceOverride(graph, label.id, ['text', 'fontSize'])

    graph.detachInstance(instance.id)

    const fields = tagCopy.instanceOverrides.descendants.get(label.id)
    expect([...(fields?.keys() ?? [])].sort()).toEqual(['fontSize', 'text'])
    expect(label.text).toBe('Práctica libre')
  })

  test('leaves a swapped nested instance showing its new component, with no swap of its own', () => {
    const { graph, pageId, instance, tagCopy } = cardInstance()
    const badge = graph.createNode('COMPONENT', pageId, { name: 'Badge' })
    graph.createNode('TEXT', badge.id, { name: 'Label', text: 'Badge' })
    graph.swapInstanceComponent(tagCopy.id, badge.id)

    graph.detachInstance(instance.id)

    expect(graph.getNode(tagCopy.id)?.componentId).toBe(badge.id)
    expect(tagCopy.instanceOverrides.self.has('componentId')).toBe(false)
    expect(tagCopy.instanceOverrides.self.has('sourceComponentId')).toBe(false)
  })
})
