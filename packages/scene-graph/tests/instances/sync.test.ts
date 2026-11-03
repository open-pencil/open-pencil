import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'
import { reconcileVariableBindings } from '@open-pencil/scene-graph/variables'

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${what}`)
  return value
}

/**
 * A Chip whose width and whose bar's width are bound to a Size variable (S 100, L 200), drawn
 * in a Card, and a Card placed in mode L, as Figma draws a nested instance in its outer mode.
 */
function chipInLargeCard() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const collection = graph.createCollection('Size')
  const large = must(graph.createMode(collection.id, 'L'), 'mode')
  const width = graph.createVariable('Width', 'FLOAT', collection.id, 100)
  width.valuesByMode[large] = 200
  const chip = graph.createNode('COMPONENT', page, { name: 'Chip', width: 100, height: 20 })
  graph.bindVariable(chip.id, 'width', width.id)
  const bar = graph.createNode('RECTANGLE', chip.id, { name: 'Bar', width: 100, height: 4 })
  graph.bindVariable(bar.id, 'width', width.id)
  const card = graph.createNode('COMPONENT', page, { name: 'Card', width: 300, height: 40 })
  must(graph.createInstance(chip.id, card.id), 'chip in card')
  const placed = must(graph.createInstance(card.id, page), 'placed card')
  // The placed card sets its own mode, as the editor and the reader record it.
  setInstanceOverride(placed.instanceOverrides, placed.id, placed.id, 'variableModes')
  graph.updateNode(placed.id, { variableModes: { [collection.id]: large } })
  reconcileVariableBindings(graph)
  const nested = () => must(graph.getChildren(placed.id)[0], 'nested chip')
  const nestedBar = () => must(graph.getChildren(nested().id)[0], 'nested bar')
  return { graph, chip, card, nested, nestedBar }
}

test('syncing an edited component keeps a bound number in the mode its copy sits in', () => {
  const { graph, chip, card, nested, nestedBar } = chipInLargeCard()
  expect([nested().width, nestedBar().width]).toEqual([200, 200])

  graph.updateNode(chip.id, { opacity: 0.9 })
  graph.syncInstancesTogether([chip.id, card.id])

  expect(nested().opacity).toBe(0.9)
  expect([nested().width, nestedBar().width]).toEqual([200, 200])
})
