import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  populateAndApplyOverrides,
  protectField,
  syncNodeProps,
  type ProtectionMap
} from '../src/instance-overrides'
import { propagateOverridesTransitively } from '../src/instance-overrides/sync/propagate'

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

  test('repositions pinned children through nested resized instances', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', pageId, {
      width: 442,
      height: 32,
      layoutMode: 'HORIZONTAL'
    })
    graph.createNode('TEXT', component.id, { x: 32, y: 6, width: 80, height: 20 })
    graph.createNode('TEXT', component.id, { x: 120, y: 6, width: 80, height: 20 })
    graph.createNode('INSTANCE', component.id, {
      x: 420,
      y: 9,
      width: 14,
      height: 14,
      layoutPositioning: 'ABSOLUTE',
      horizontalConstraint: 'MAX',
      verticalConstraint: 'CENTER'
    })
    const source = graph.createNode('INSTANCE', pageId, {
      width: 256,
      height: 32,
      layoutMode: 'HORIZONTAL',
      componentId: component.id
    })
    const instance = graph.createNode('INSTANCE', pageId, {
      width: 256,
      height: 32,
      layoutMode: 'HORIZONTAL',
      componentId: source.id
    })

    populateAndApplyOverrides(graph, new Map(), new Map())

    const pinned = graph.getChildren(instance.id)[2]
    expect(pinned).toMatchObject({ x: 234, y: 9, width: 14, height: 14 })
  })

  test('resizes stretched absolute children with resized instances', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', pageId, {
      width: 100,
      height: 80,
      layoutMode: 'HORIZONTAL'
    })
    graph.createNode('RECTANGLE', component.id, {
      x: 10,
      y: 10,
      width: 80,
      height: 60,
      layoutPositioning: 'ABSOLUTE',
      horizontalConstraint: 'STRETCH',
      verticalConstraint: 'STRETCH'
    })
    const instance = graph.createNode('INSTANCE', pageId, {
      width: 200,
      height: 120,
      layoutMode: 'HORIZONTAL',
      componentId: component.id
    })

    populateAndApplyOverrides(graph, new Map(), new Map())

    expect(graph.getChildren(instance.id)[0]).toMatchObject({
      x: 10,
      y: 10,
      width: 180,
      height: 100
    })
  })

  test('applies pinned constraints inside resized freeform instances', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', pageId, { width: 100, height: 80 })
    graph.createNode('RECTANGLE', component.id, {
      x: 80,
      y: 10,
      width: 10,
      height: 60,
      layoutPositioning: 'ABSOLUTE',
      horizontalConstraint: 'MAX',
      verticalConstraint: 'STRETCH'
    })
    const instance = graph.createNode('INSTANCE', pageId, {
      width: 200,
      height: 120,
      componentId: component.id
    })

    populateAndApplyOverrides(graph, new Map(), new Map())

    expect(graph.getChildren(instance.id)[0]).toMatchObject({
      x: 180,
      y: 10,
      width: 10,
      height: 100
    })
  })

  test('preserves an inset child when a nested instance becomes narrower', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const field = graph.createNode('COMPONENT', pageId, { width: 280, height: 40 })
    graph.createNode('TEXT', field.id, {
      x: 16,
      y: 10,
      width: 248,
      height: 20,
      text: 'Placeholder'
    })
    const source = graph.createNode('INSTANCE', pageId, {
      width: 240,
      height: 40,
      componentId: field.id
    })
    const instance = graph.createNode('INSTANCE', pageId, {
      width: 180,
      height: 40,
      componentId: source.id
    })

    populateAndApplyOverrides(graph, new Map(), new Map())

    const placeholder = graph.getChildren(instance.id)[0]
    expect(placeholder).toMatchObject({ x: 16, y: 10, text: 'Placeholder' })
  })

  test('scales target-aspect instance geometry through fixed wrappers', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', pageId, { width: 310, height: 62 })
    const wrapper = graph.createNode('FRAME', component.id, { width: 310, height: 61.214 })
    const inset = graph.createNode('RECTANGLE', wrapper.id, {
      x: 250,
      y: 10,
      width: 20,
      height: 20,
      horizontalConstraint: 'MAX',
      verticalConstraint: 'MIN'
    })
    const vector = graph.createNode('VECTOR', wrapper.id, {
      width: 56.392,
      height: 61.214,
      horizontalConstraint: 'SCALE',
      verticalConstraint: 'SCALE'
    })
    const instance = graph.createNode('INSTANCE', pageId, {
      width: 100,
      height: 20,
      componentId: component.id
    })
    instance.source.fig.rawNodeFields.targetAspectRatio = { value: { x: 310, y: 62 } }

    populateAndApplyOverrides(graph, new Map(), new Map())

    const scaledWrapper = graph.getChildren(instance.id)[0]
    const scaledShape = graph.getChildren(scaledWrapper.id)[1]
    const preservedInset = graph.getChildren(scaledWrapper.id)[0]
    expect(scaledWrapper.width).toBeCloseTo(100)
    expect(scaledWrapper.height).toBeCloseTo((61.214 * 20) / 62)
    expect(preservedInset).toMatchObject({
      x: inset.x,
      y: inset.y,
      width: inset.width,
      height: inset.height
    })
    expect(scaledShape.width).toBeCloseTo((vector.width * 100) / 310)
    expect(scaledShape.height).toBeCloseTo((vector.height * 20) / 62)
  })

  test('uses target-aspect metadata only to reach scale-constrained descendants', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', pageId, { width: 24, height: 24 })
    const vector = graph.createNode('VECTOR', component.id, {
      x: 9,
      y: 3,
      width: 6,
      height: 6,
      horizontalConstraint: 'SCALE',
      verticalConstraint: 'SCALE'
    })
    const instance = graph.createNode('INSTANCE', pageId, {
      width: 14,
      height: 14,
      componentId: component.id
    })
    instance.source.fig.rawNodeFields.targetAspectRatio = { value: { x: 32, y: 32 } }

    populateAndApplyOverrides(graph, new Map(), new Map())

    const scaledVector = graph.getChildren(instance.id)[0]
    expect(scaledVector).toMatchObject({
      x: (vector.x * 14) / 24,
      y: (vector.y * 14) / 24,
      width: (vector.width * 14) / 24,
      height: (vector.height * 14) / 24
    })
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

  test('restores effective image and thin-clone geometry after final swaps', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const avatarComponent = graph.createNode('COMPONENT', pageId, { width: 100, height: 100 })
    graph.createNode('ROUNDED_RECTANGLE', avatarComponent.id, {
      width: 100,
      height: 100,
      horizontalConstraint: 'SCALE',
      verticalConstraint: 'SCALE',
      fills: [
        { type: 'IMAGE', imageHash: 'avatar', opacity: 1, visible: true, blendMode: 'NORMAL' }
      ]
    })
    const avatar = graph.createNode('INSTANCE', pageId, {
      componentId: avatarComponent.id,
      width: 14,
      height: 14
    })

    const dividerComponent = graph.createNode('COMPONENT', pageId, {
      width: 112,
      height: 28,
      layoutMode: 'HORIZONTAL',
      counterAxisAlign: 'CENTER'
    })
    const dividerSource = graph.createNode('RECTANGLE', dividerComponent.id, {
      x: 0,
      y: 13.5,
      width: 112,
      height: 1,
      derivedLayout: { x: 0, y: 13.5, width: 112, height: 1 }
    })
    const dividerInstance = graph.createNode('INSTANCE', pageId, {
      componentId: dividerComponent.id,
      width: 112,
      height: 28,
      layoutMode: 'HORIZONTAL',
      counterAxisAlign: 'CENTER'
    })

    populateAndApplyOverrides(graph, new Map(), new Map())

    const avatarLeaf = graph.getChildren(avatar.id)[0]
    expect(avatarLeaf).toMatchObject({ width: 14, height: 14 })
    const divider = graph.getChildren(dividerInstance.id)[0]
    expect(divider.componentId).toBe(dividerSource.id)
    expect(divider.derivedLayout).toMatchObject({ x: 0, y: 13.5 })
  })

  test('leaves unrelated scaled vector and multi-child instance geometry unchanged', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const vectorComponent = graph.createNode('COMPONENT', pageId, { width: 100, height: 100 })
    graph.createNode('VECTOR', vectorComponent.id, {
      width: 20,
      height: 10,
      horizontalConstraint: 'SCALE',
      verticalConstraint: 'SCALE'
    })
    const vectorInstance = graph.createNode('INSTANCE', pageId, {
      componentId: vectorComponent.id,
      width: 50,
      height: 50
    })
    const multiComponent = graph.createNode('COMPONENT', pageId, { width: 100, height: 100 })
    graph.createNode('ROUNDED_RECTANGLE', multiComponent.id, {
      width: 100,
      height: 100,
      horizontalConstraint: 'SCALE',
      verticalConstraint: 'SCALE',
      fills: [
        { type: 'IMAGE', imageHash: 'avatar', opacity: 1, visible: true, blendMode: 'NORMAL' }
      ]
    })
    graph.createNode('RECTANGLE', multiComponent.id, { width: 10, height: 10 })
    const multiInstance = graph.createNode('INSTANCE', pageId, {
      componentId: multiComponent.id,
      width: 50,
      height: 50
    })

    populateAndApplyOverrides(graph, new Map(), new Map())

    expect(graph.getChildren(vectorInstance.id)[0]).toMatchObject({ width: 10, height: 5 })
    expect(graph.getChildren(multiInstance.id)[0]).toMatchObject({ width: 50, height: 50 })
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

  test('synchronizes opacity bindings with their resolved value', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const source = graph.createNode('INSTANCE', pageId, {
      opacity: 0.5,
      boundVariables: { opacity: 'opacity-var' }
    })
    const target = graph.createNode('INSTANCE', pageId, {
      opacity: 1,
      componentId: source.id
    })

    syncNodeProps(graph, source, target)

    expect(graph.getNode(target.id)).toMatchObject({
      opacity: 0.5,
      boundVariables: { opacity: 'opacity-var' }
    })
  })

  test('clears opacity bindings removed from the source', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const source = graph.createNode('INSTANCE', pageId, { opacity: 1 })
    const target = graph.createNode('INSTANCE', pageId, {
      opacity: 0.5,
      componentId: source.id,
      boundVariables: { opacity: 'stale-opacity-var', width: 'width-var' }
    })

    syncNodeProps(graph, source, target)

    expect(graph.getNode(target.id)?.boundVariables).toEqual({ width: 'width-var' })
  })

  test('inherits effective text on a structurally protected clone', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', pageId)
    const source = graph.createNode('TEXT', component.id, {
      text: 'Effective label'
    })
    const instance = graph.createNode('INSTANCE', pageId, { componentId: component.id })
    graph.populateInstanceChildren(instance.id, component.id, 'fig-import')
    const clone = graph.getChildren(instance.id)[0]
    graph.updateNode(clone.id, { text: 'Default label' })
    const protections: ProtectionMap = new Map()
    protectField(protections, clone.id, 'width')

    propagateOverridesTransitively(
      graph,
      new Set([source.id, clone.id]),
      new Set(),
      new Map(),
      undefined,
      undefined,
      protections
    )

    expect(graph.getNode(clone.id)?.text).toBe('Effective label')
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
