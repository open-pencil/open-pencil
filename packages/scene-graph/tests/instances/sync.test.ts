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

test('syncing a component that rebinds a number resolves its copies by the new binding', () => {
  const { graph, chip, card, nested } = chipInLargeCard()
  const collection = must([...graph.variableCollections.values()][0], 'collection')
  const large = must(collection.modes.find((mode) => mode.name === 'L'), 'mode').modeId
  // 100 in either mode, so the copy in the card shows the component's own width.
  const flat = graph.createVariable('Flat', 'FLOAT', collection.id, 100)
  flat.valuesByMode[large] = 100
  graph.bindVariable(chip.id, 'width', flat.id)
  graph.syncInstancesTogether([chip.id, card.id])
  expect(nested().width).toBe(100)
  // The same value as the old binding in the component's mode, another in the card's.
  const wide = graph.createVariable('Wide', 'FLOAT', collection.id, 100)
  wide.valuesByMode[large] = 300
  graph.bindVariable(chip.id, 'width', wide.id)
  graph.syncInstancesTogether([chip.id, card.id])

  expect(nested().boundVariables.width).toBe(wide.id)
  expect(nested().width).toBe(300)
})

test('syncing a component that rebinds a number keeps the value its instance overrides', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const collection = graph.createCollection('Look')
  const faded = graph.createVariable('Faded', 'FLOAT', collection.id, 0.8)
  const dim = graph.createVariable('Dim', 'FLOAT', collection.id, 0.5)
  const chip = graph.createNode('COMPONENT', page, { name: 'Chip', width: 40, height: 20 })
  graph.bindVariable(chip.id, 'opacity', faded.id)
  reconcileVariableBindings(graph)
  const instance = must(graph.createInstance(chip.id, page), 'instance')
  setInstanceOverride(instance.instanceOverrides, instance.id, instance.id, 'opacity')
  graph.updateNode(instance.id, { opacity: 0.3 })

  graph.bindVariable(chip.id, 'opacity', dim.id)
  reconcileVariableBindings(graph, { subtrees: [chip.id] })
  graph.syncInstances(chip.id)

  expect(must(graph.getNode(instance.id), 'synced instance').opacity).toBe(0.3)
})

// Figma (desktop 126) keeps such a layer at its x and grows it, in the instance's mode and
// after the component changes: constraints place a layer when its parent resizes, not when
// its own bound size does.
test('syncing keeps a right-constrained layer at its x as its bound width grows', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const collection = graph.createCollection('Size')
  const large = must(graph.createMode(collection.id, 'L'), 'mode')
  const width = graph.createVariable('Width', 'FLOAT', collection.id, 100)
  width.valuesByMode[large] = 200
  const box = graph.createNode('COMPONENT', page, { name: 'Box', width: 300, height: 40 })
  const bar = graph.createNode('RECTANGLE', box.id, {
    name: 'Bar',
    x: 180,
    width: 100,
    height: 4,
    horizontalConstraint: 'MAX'
  })
  graph.bindVariable(bar.id, 'width', width.id)
  const placed = must(graph.createInstance(box.id, page), 'placed box')
  setInstanceOverride(placed.instanceOverrides, placed.id, placed.id, 'variableModes')
  graph.updateNode(placed.id, { variableModes: { [collection.id]: large } })
  reconcileVariableBindings(graph)

  graph.updateNode(box.id, { opacity: 0.9 })
  graph.syncInstances(box.id)

  const copy = must(graph.getChildren(placed.id)[0], 'bar copy')
  expect(copy.width).toBe(200)
  expect(copy.x).toBe(180)
})

test('syncing a component that changed its own mode resolves its copies in the new mode', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const collection = graph.createCollection('Size')
  const large = must(graph.createMode(collection.id, 'L'), 'mode')
  const width = graph.createVariable('Width', 'FLOAT', collection.id, 100)
  width.valuesByMode[large] = 200
  const chip = graph.createNode('COMPONENT', page, { name: 'Chip', width: 100, height: 20 })
  graph.bindVariable(chip.id, 'width', width.id)
  const instance = must(graph.createInstance(chip.id, page), 'instance')
  expect(instance.width).toBe(100)

  graph.updateNode(chip.id, { variableModes: { [collection.id]: large } })
  reconcileVariableBindings(graph, { subtrees: [chip.id] })
  graph.syncInstances(chip.id)

  const synced = must(graph.getNode(instance.id), 'synced instance')
  expect(synced.variableModes).toEqual({ [collection.id]: large })
  expect(synced.width).toBe(200)
})

test('syncing a component keeps a bound number its instance overrides', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const collection = graph.createCollection('Look')
  const faded = graph.createVariable('Faded', 'FLOAT', collection.id, 0.8)
  const chip = graph.createNode('COMPONENT', page, { name: 'Chip', width: 40, height: 20 })
  graph.bindVariable(chip.id, 'opacity', faded.id)
  reconcileVariableBindings(graph)
  const instance = must(graph.createInstance(chip.id, page), 'instance')
  setInstanceOverride(instance.instanceOverrides, instance.id, instance.id, 'opacity')
  graph.updateNode(instance.id, { opacity: 0.3 })

  graph.updateNode(chip.id, { width: 60 })
  graph.syncInstances(chip.id)

  const synced = must(graph.getNode(instance.id), 'synced instance')
  expect(synced.width).toBe(60)
  expect(synced.opacity).toBe(0.3)
})

// Figma (desktop, 2026-11-07): a copy in an instance resized to 113.3×57.1, then synced after its
// component's layer changes, scales by the exact ratio; one Left & right stretched past zero in a
// 70-wide instance stays turned over.
test('syncing places copies by their constraints, exactly, and keeps them turned over', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const box = graph.createNode('COMPONENT', page, { name: 'Box', width: 100, height: 50 })
  const dot = graph.createNode('RECTANGLE', box.id, {
    x: 0.7,
    y: 3.75,
    width: 22.6,
    height: 16.5,
    horizontalConstraint: 'SCALE',
    verticalConstraint: 'SCALE'
  })
  const bar = graph.createNode('RECTANGLE', box.id, {
    x: 10,
    y: 30,
    width: 20,
    height: 10,
    horizontalConstraint: 'STRETCH'
  })
  const resized = (width: number, height: number) => {
    const instance = must(graph.createInstance(box.id, page), 'instance')
    for (const field of ['width', 'height'])
      setInstanceOverride(instance.instanceOverrides, instance.id, instance.id, field)
    graph.updateNode(instance.id, { width, height })
    return instance
  }
  const scaled = resized(113.3, 57.1)
  const narrow = resized(70, 57.1)

  graph.updateNode(dot.id, { x: 1.3, width: 22.9 })
  graph.updateNode(bar.id, { y: 31 })
  graph.syncInstances(box.id)

  const round = (value: number) => Math.round(value * 1e4) / 1e4
  const dotCopy = must(graph.getChildren(scaled.id)[0], 'dot copy')
  expect([dotCopy.x, dotCopy.y, dotCopy.width, dotCopy.height].map(round)).toEqual([
    1.4729, 4.2825, 25.9457, 18.843
  ])
  const barCopy = must(graph.getChildren(narrow.id)[1], 'bar copy')
  expect(barCopy).toMatchObject({ x: 0, y: 31, width: 10, height: 10, flipX: true })
})
