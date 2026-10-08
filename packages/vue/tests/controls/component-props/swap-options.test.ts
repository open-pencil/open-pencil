import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { instanceSwapOptions } from '#vue/controls/component-props/model'

test('leaves out swaps that would contain themselves and names variants with their set', () => {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const star = graph.createNode('COMPONENT', pageId, { name: 'Star' })
  const button = graph.createNode('COMPONENT', pageId, { name: 'Button' })
  const icon = graph.createInstance(star.id, button.id, { name: 'Icon' })
  const card = graph.createNode('COMPONENT', pageId, { name: 'Card' })
  const action = graph.createInstance(button.id, card.id, { name: 'Action' })
  const badge = graph.createNode('COMPONENT_SET', pageId, { name: 'Badge' })
  const info = graph.createNode('COMPONENT', badge.id, { name: 'State=Info' })
  if (!icon || !action) throw new Error('Expected instances')
  const definition = {
    id: '1:4',
    name: 'Icon',
    type: 'INSTANCE_SWAP' as const,
    defaultValue: star.id
  }
  const components = [...graph.getAllNodes()]

  // The icon inside Button, as Card's Action shows it: neither Button nor Card can replace it.
  const options = instanceSwapOptions(graph, components, definition, star.id, [action.id])
  expect(options.map((option) => option.label)).toEqual(['Badge / State=Info', 'Star'])
  expect(options.map((option) => option.value)).toEqual([info.id, star.id])
})

test('a swap with no layers yet still has to fit inside its own component', () => {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const star = graph.createNode('COMPONENT', pageId, { name: 'Star' })
  const button = graph.createNode('COMPONENT', pageId, { name: 'Button' })
  const card = graph.createNode('COMPONENT', pageId, { name: 'Card' })
  graph.createInstance(button.id, card.id)
  const definition = { id: '1:5', name: 'Icon', type: 'INSTANCE_SWAP' as const, defaultValue: '' }

  const options = instanceSwapOptions(graph, [star, button, card], definition, '', [button.id])
  expect(options.map((option) => option.label)).toEqual(['Star'])
})
