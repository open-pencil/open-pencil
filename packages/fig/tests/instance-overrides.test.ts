import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  populateAndApplyOverrides,
  protectField,
  syncNodeProps,
  type ProtectionMap
} from '../src/instance-overrides'

describe('@open-pencil/fig instance interpretation', () => {
  test('populates an empty instance from its component tree', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', pageId, { name: 'Button' })
    graph.createNode('TEXT', component.id, { text: 'Label' })
    const instance = graph.createNode('INSTANCE', pageId, {
      componentId: component.id,
      childIds: []
    })

    populateAndApplyOverrides(graph, new Map(), new Map())

    const populated = graph.getNode(instance.id)
    expect(populated?.childIds).toHaveLength(1)
    expect(graph.getNode(populated?.childIds[0] ?? '')?.text).toBe('Label')
  })

  test('limits lazy population to required global propagation scans', () => {
    const graph = new SceneGraph()
    const activePage = graph.getPages()[0]
    const unrelatedPage = graph.addPage('Unrelated')
    const component = graph.createNode('COMPONENT', unrelatedPage.id, {
      width: 100,
      height: 40
    })
    graph.createNode('TEXT', component.id, { text: 'Label' })
    const instance = graph.createNode('INSTANCE', activePage.id, {
      width: 100,
      height: 40,
      componentId: component.id
    })
    for (let index = 0; index < 5_000; index++) {
      graph.createNode('RECTANGLE', unrelatedPage.id)
    }

    let globalScans = 0
    const getAllNodes = graph.getAllNodes.bind(graph)
    graph.getAllNodes = () => {
      globalScans++
      return getAllNodes()
    }

    populateAndApplyOverrides(graph, new Map(), new Map(), [], [activePage.id])

    expect(graph.getNode(instance.id)?.childIds).toHaveLength(1)
    expect(globalScans).toBe(2)
  })

  test('resolves text clone chains to their source values', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const source = graph.createNode('TEXT', pageId, {
      text: 'Label',
      width: 80,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const middle = graph.createNode('TEXT', pageId, {
      componentId: source.id,
      text: 'Label',
      width: 120
    })
    const leaf = graph.createNode('TEXT', pageId, {
      componentId: middle.id,
      text: 'Label',
      width: 160
    })

    populateAndApplyOverrides(graph, new Map(), new Map())

    expect(graph.getNode(middle.id)?.width).toBe(80)
    expect(graph.getNode(leaf.id)).toMatchObject({ width: 80, fills: source.fills })
  })

  test('preserves protected text while synchronizing other fields', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const source = graph.createNode('TEXT', pageId, { text: 'Source', visible: false })
    const target = graph.createNode('TEXT', pageId, { text: 'Override', visible: true })
    const protections: ProtectionMap = new Map()
    protectField(protections, target.id, 'text')

    syncNodeProps(graph, source, target, protections)

    expect(graph.getNode(target.id)).toMatchObject({ text: 'Override', visible: false })
  })
})
