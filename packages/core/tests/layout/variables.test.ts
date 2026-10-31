import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { reconcileVariableBindings, type BindingScope } from '@open-pencil/scene-graph/variables'

import { computeAllLayouts, computeLayout, setTextMeasurer } from '#core/layout'
import { reconcileVariableLayouts } from '#core/layout/variables'

function buildDocument() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const tokens = graph.createCollection('Tokens')
  const compact = 'compact'
  graph.addMode(tokens.id, compact, 'Compact')
  const comfortable = tokens.defaultModeId
  const padding = graph.createVariable('Padding', 'FLOAT', tokens.id, 16)
  const gap = graph.createVariable('Gap', 'FLOAT', tokens.id, 12)
  const size = graph.createVariable('Size', 'FLOAT', tokens.id, 40)
  const inset = graph.createVariable('Inset', 'FLOAT', tokens.id, { aliasId: padding.id })
  const label = graph.createVariable('Label', 'STRING', tokens.id, 'Save')
  padding.valuesByMode[compact] = 4
  gap.valuesByMode[compact] = 2
  size.valuesByMode[compact] = 24
  inset.valuesByMode[compact] = 6
  label.valuesByMode[compact] = 'Save as draft'

  const autoLayout = (direction: 'HORIZONTAL' | 'VERTICAL'): Partial<SceneNode> => ({
    layoutMode: direction,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG'
  })
  const outer = graph.createNode('FRAME', page.id, {
    ...autoLayout('VERTICAL'),
    boundVariables: { itemSpacing: gap.id, paddingTop: padding.id }
  })
  for (let row = 0; row < 3; row++) {
    const rowFrame = graph.createNode('FRAME', outer.id, {
      ...autoLayout('HORIZONTAL'),
      boundVariables: { paddingLeft: padding.id, itemSpacing: gap.id }
    })
    const card = graph.createNode(row === 1 ? 'INSTANCE' : 'FRAME', rowFrame.id, {
      ...autoLayout('VERTICAL'),
      boundVariables: { paddingTop: inset.id, paddingBottom: inset.id }
    })
    if (row === 1) {
      card.source.format = 'fig'
    }
    graph.createNode('RECTANGLE', card.id, {
      width: 10,
      height: 10,
      boundVariables: { width: size.id, height: size.id }
    })
    graph.createNode('RECTANGLE', rowFrame.id, { width: 20, height: 8 })
    graph.createNode('TEXT', rowFrame.id, {
      text: 'Save',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      boundVariables: { text: label.id }
    })
  }
  computeAllLayouts(graph)
  return { graph, tokens, compact, comfortable, padding, outer }
}

type Document = ReturnType<typeof buildDocument>

function layOutEachChangedLayer(graph: SceneGraph, scope: BindingScope): void {
  for (const id of reconcileVariableBindings(graph, scope)) {
    computeLayout(graph, id)
    computeAllLayouts(graph, id)
    let parentId = graph.getNode(id)?.parentId
    while (parentId) {
      const parent = graph.getNode(parentId)
      if (parent?.layoutMode !== 'NONE') {
        computeLayout(graph, parentId)
      }
      parentId = parent?.parentId
    }
  }
}

function geometry(graph: SceneGraph) {
  return graph
    .flattenTree(graph.getPages()[0].id)
    .map(({ node }) => [node.type, node.x, node.y, node.width, node.height])
}

function expectSameLayoutAsPerLayer(change: (document: Document) => BindingScope) {
  const perLayer = buildDocument()
  const batched = buildDocument()
  const before = geometry(batched.graph)
  layOutEachChangedLayer(perLayer.graph, change(perLayer))
  reconcileVariableLayouts(batched.graph, change(batched))
  expect(geometry(batched.graph)).toEqual(geometry(perLayer.graph))
  expect(geometry(batched.graph)).not.toEqual(before)
}

describe('reconcileVariableLayouts', () => {
  beforeEach(() => setTextMeasurer((node) => ({ width: node.text.length * 8, height: 16 })))
  afterEach(() => setTextMeasurer(null))

  test('an explicit mode on a container lays its layers out as one layer at a time would', () => {
    expectSameLayoutAsPerLayer(({ graph, tokens, compact, outer }) => {
      graph.updateNode(outer.id, { variableModes: { [tokens.id]: compact } })
      return { subtrees: [outer.id] }
    })
  })

  test('an explicit mode on one nested layer reflows the layouts around it', () => {
    expectSameLayoutAsPerLayer(({ graph, tokens, compact, outer }) => {
      const middleRow = outer.childIds[1]
      graph.updateNode(middleRow, { variableModes: { [tokens.id]: compact } })
      return { subtrees: [middleRow] }
    })
  })

  test('an active mode change lays out every layer it reaches as one layer at a time would', () => {
    expectSameLayoutAsPerLayer(({ graph, tokens, compact }) => {
      graph.setActiveMode(tokens.id, compact)
      return { variables: tokens.variableIds }
    })
  })

  test('a value edit through an alias lays out as one layer at a time would', () => {
    expectSameLayoutAsPerLayer(({ padding, comfortable }) => {
      padding.valuesByMode[comfortable] = 30
      return { variables: [padding.id] }
    })
  })

  test('a text outside auto layout resizes to a bound font size', () => {
    setTextMeasurer((node) => ({ width: node.text.length * node.fontSize, height: node.fontSize }))
    const graph = new SceneGraph()
    const tokens = graph.createCollection('Tokens')
    graph.addMode(tokens.id, 'large', 'Large')
    const size = graph.createVariable('Size', 'FLOAT', tokens.id, 10)
    size.valuesByMode.large = 20
    const label = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Save',
      fontSize: 10,
      width: 40,
      height: 10,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      boundVariables: { fontSize: size.id }
    })

    graph.setActiveMode(tokens.id, 'large')
    reconcileVariableLayouts(graph, { variables: [size.id] })

    expect([label.fontSize, label.width, label.height]).toEqual([20, 80, 20])
  })

  test('a layer scaled by its constraints follows its Hug frame once per change', () => {
    const graph = new SceneGraph()
    const tokens = graph.createCollection('Tokens')
    graph.addMode(tokens.id, 'compact', 'Compact')
    const width = graph.createVariable('Width', 'FLOAT', tokens.id, 100)
    width.valuesByMode.compact = 60
    const hug = { primaryAxisSizing: 'HUG', counterAxisSizing: 'HUG' } as const
    const outer = graph.createNode('FRAME', graph.getPages()[0].id, {
      layoutMode: 'VERTICAL',
      ...hug
    })
    const row = graph.createNode('FRAME', outer.id, { layoutMode: 'HORIZONTAL', ...hug })
    const button = graph.createNode('FRAME', row.id, { layoutMode: 'HORIZONTAL', ...hug })
    graph.createNode('RECTANGLE', button.id, {
      width: 100,
      height: 20,
      boundVariables: { width: width.id }
    })
    graph.createNode('RECTANGLE', row.id, {
      width: 10,
      height: 10,
      boundVariables: { height: width.id }
    })
    const badge = graph.createNode('RECTANGLE', button.id, {
      x: 10,
      width: 80,
      height: 20,
      layoutPositioning: 'ABSOLUTE',
      horizontalConstraint: 'SCALE'
    })
    computeAllLayouts(graph)

    graph.updateNode(outer.id, { variableModes: { [tokens.id]: 'compact' } })
    reconcileVariableLayouts(graph, { subtrees: [outer.id] })

    expect(button.width).toBe(60)
    expect(badge.width).toBe(48)
  })
})
