import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

function setupColorVars(graph: SceneGraph, ...ids: string[]): void {
  graph.addCollection({
    id: 'col1',
    name: 'Colors',
    modes: [{ modeId: 'm1', name: 'Light' }],
    defaultModeId: 'm1',
    variableIds: []
  })
  for (const id of ids) {
    graph.addVariable({
      id,
      name: `Var ${id}`,
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { r: 0.5, g: 0.5, b: 0.5, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })
  }
}

function setupFloatVars(graph: SceneGraph, ...ids: string[]): void {
  graph.addCollection({
    id: 'col-f',
    name: 'Floats',
    modes: [{ modeId: 'm1', name: 'Light' }],
    defaultModeId: 'm1',
    variableIds: []
  })
  for (const id of ids) {
    graph.addVariable({
      id,
      name: `Var ${id}`,
      type: 'FLOAT',
      collectionId: 'col-f',
      valuesByMode: { m1: 1 },
      description: '',
      hiddenFromPublishing: false
    })
  }
}

// ─── bindVariable on instance child sets override flag ──────────────────

describe('bindVariable on instance child sets override flag', () => {
  test('binding on instance child sets boundVariables override on parent instance', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1', 'v2')
    const page = pageId(graph)

    const component = graph.createNode('COMPONENT', page, {
      name: 'Button',
      width: 100,
      height: 40
    })
    const child = graph.createNode('RECTANGLE', component.id, {
      name: 'Bg',
      width: 100,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(child.id, 'fills/0/color', 'v1')

    const instance =
      graph.createInstance(component.id, page) ??
      (() => {
        throw new Error('instance failed')
      })()
    const instanceChild = graph.getChildren(instance.id)[0]

    graph.bindVariable(instanceChild.id, 'fills/0/color', 'v2')

    expect(instance.overrides[`${instanceChild.id}:boundVariables`]).toBe(true)
  })

  test('binding on instance child survives syncInstances', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1', 'v2')
    const page = pageId(graph)

    const component = graph.createNode('COMPONENT', page, {
      name: 'Button',
      width: 100,
      height: 40
    })
    const child = graph.createNode('RECTANGLE', component.id, {
      name: 'Bg',
      width: 100,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(child.id, 'fills/0/color', 'v1')

    const instance =
      graph.createInstance(component.id, page) ??
      (() => {
        throw new Error('instance failed')
      })()
    const instanceChild = graph.getChildren(instance.id)[0]

    graph.bindVariable(instanceChild.id, 'fills/0/color', 'v2')

    graph.syncInstances(component.id)

    expect(instanceChild.boundVariables['fills/0/color']).toBe('v2')
  })
})

// ─── bindVariable on INSTANCE node itself sets override ──────────────────

describe('bindVariable on INSTANCE node itself sets override', () => {
  test('binding on INSTANCE node sets bare boundVariables override key', () => {
    const graph = new SceneGraph()
    setupFloatVars(graph, 'v1', 'v2')
    const page = pageId(graph)

    const component = graph.createNode('COMPONENT', page, {
      name: 'Button',
      width: 100,
      height: 40,
      opacity: 1
    })
    graph.bindVariable(component.id, 'opacity', 'v1')

    const instance =
      graph.createInstance(component.id, page) ??
      (() => {
        throw new Error('instance failed')
      })()

    graph.bindVariable(instance.id, 'opacity', 'v2')

    expect(instance.overrides['boundVariables']).toBe(true)
  })

  test('binding on INSTANCE node survives syncInstances', () => {
    const graph = new SceneGraph()
    setupFloatVars(graph, 'v1', 'v2')
    const page = pageId(graph)

    const component = graph.createNode('COMPONENT', page, {
      name: 'Button',
      width: 100,
      height: 40,
      opacity: 1
    })
    graph.bindVariable(component.id, 'opacity', 'v1')

    const instance =
      graph.createInstance(component.id, page) ??
      (() => {
        throw new Error('instance failed')
      })()

    graph.bindVariable(instance.id, 'opacity', 'v2')

    graph.bindVariable(component.id, 'opacity', 'v1')
    graph.syncInstances(component.id)

    expect(instance.boundVariables['opacity']).toBe('v2')
  })
})

// ─── removeVariable emits events and sets overrides ────────────────────

describe('removeVariable emits events and sets overrides', () => {
  test('removeVariable emits node:updated for affected nodes', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1')
    const page = pageId(graph)
    const node = graph.createNode('RECTANGLE', page, {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(node.id, 'fills/0/color', 'v1')

    const events: Array<{ nodeId: string; changes: Record<string, unknown> }> = []
    graph.onNodeEvents({
      updated: (nodeId, changes) => events.push({ nodeId, changes })
    })

    graph.removeVariable('v1')

    const updateEvent = events.find((e) => e.nodeId === node.id)
    expect(updateEvent).toBeDefined()
    if (updateEvent) {
      expect('boundVariables' in updateEvent.changes).toBe(true)
    }
  })

  test('removeVariable sets instance override on affected instance child', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1')
    const page = pageId(graph)

    const component = graph.createNode('COMPONENT', page, {
      name: 'Button',
      width: 100,
      height: 40
    })
    const compChild = graph.createNode('RECTANGLE', component.id, {
      name: 'Bg',
      width: 100,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(compChild.id, 'fills/0/color', 'v1')

    const instance =
      graph.createInstance(component.id, page) ??
      (() => {
        throw new Error('instance failed')
      })()
    const instanceChild = graph.getChildren(instance.id)[0]

    graph.removeVariable('v1')

    expect(instance.overrides[`${instanceChild.id}:boundVariables`]).toBe(true)
  })

  test('removeVariable does not emit for unaffected nodes', () => {
    const graph = new SceneGraph()
    setupFloatVars(graph, 'v1')
    const page = pageId(graph)
    const nodeA = graph.createNode('RECTANGLE', page, { name: 'A' })
    const nodeB = graph.createNode('RECTANGLE', page, { name: 'B' })
    graph.bindVariable(nodeA.id, 'opacity', 'v1')

    const events: Array<{ nodeId: string }> = []
    graph.onNodeEvents({
      updated: (nodeId) => events.push({ nodeId })
    })

    graph.removeVariable('v1')

    expect(events.some((e) => e.nodeId === nodeA.id)).toBe(true)
    expect(events.some((e) => e.nodeId === nodeB.id)).toBe(false)
  })
})
