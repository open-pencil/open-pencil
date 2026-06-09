import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { nodeProxyToJSON } from '@open-pencil/core/figma-api/serialization'

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

// ─── boundVariables sync from component to instance ──────────────────────

describe('INSTANCE_SYNC_PROPS includes boundVariables', () => {
  function setupGraph(): SceneGraph {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Colors',
      modes: [{ modeId: 'm1', name: 'Light' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'Primary',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })
    graph.addVariable({
      id: 'v2',
      name: 'Secondary',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { r: 0, g: 0, b: 1, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })
    return graph
  }

  test('syncInstances propagates boundVariables from component to instance', () => {
    const graph = setupGraph()
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
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    // Bind variable on component child
    graph.bindVariable(child.id, 'fills/0/color', 'v1')

    // Create instance
    const instance =
      graph.createInstance(component.id, page) ??
      (() => {
        throw new Error('instance failed')
      })()
    const instanceChild = graph.getChildren(instance.id)[0]

    // Change component child's binding
    graph.bindVariable(child.id, 'fills/0/color', 'v2')
    // Sync
    graph.syncInstances(component.id)

    // Instance child should now have the updated binding
    expect(instanceChild.boundVariables['fills/0/color']).toBe('v2')
  })

  test('synced boundVariables is an independent copy', () => {
    const graph = setupGraph()
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
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    graph.bindVariable(child.id, 'fills/0/color', 'v1')

    const instance =
      graph.createInstance(component.id, page) ??
      (() => {
        throw new Error('instance failed')
      })()
    const instanceChild = graph.getChildren(instance.id)[0]
    const compChild = graph.getNode(child.id)

    graph.syncInstances(component.id)

    // After sync, boundVariables must still be independent objects
    expect(instanceChild.boundVariables).not.toBe(compChild.boundVariables)
  })

  test('instance override blocks boundVariables sync', () => {
    const graph = setupGraph()
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
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    graph.bindVariable(child.id, 'fills/0/color', 'v1')

    const instance =
      graph.createInstance(component.id, page) ??
      (() => {
        throw new Error('instance failed')
      })()
    const instanceChild = graph.getChildren(instance.id)[0]

    // Set an override to block boundVariables sync
    instance.overrides[`${instanceChild.id}:boundVariables`] = true

    // Change component child's binding
    graph.bindVariable(child.id, 'fills/0/color', 'v2')

    // Sync
    graph.syncInstances(component.id)

    // Instance child binding should NOT be overwritten (override takes precedence)
    expect(instanceChild.boundVariables['fills/0/color']).toBe('v1')
  })
})

// ─── bindVariable validation continued ────────────────────────────────────

describe('bindVariable validation continued', () => {
  function setupGraph(): SceneGraph {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Colors',
      modes: [{ modeId: 'm1', name: 'Light' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v-float',
      name: 'Spacing',
      type: 'FLOAT',
      collectionId: 'col1',
      valuesByMode: { m1: 16 },
      description: '',
      hiddenFromPublishing: false
    })
    return graph
  }

  test('bindVariable rejects unknown field names', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
    expect(() => {
      graph.bindVariable(node.id, 'customPluginField', 'v-float')
    }).toThrow(/Unknown binding field/)
  })
})

// ─── unbindVariable removes binding correctly ────────────────────────────

describe('unbindVariable', () => {
  function setupGraph(): SceneGraph {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Colors',
      modes: [{ modeId: 'm1', name: 'Light' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'Primary',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { r: 0.5, g: 0.5, b: 0.5, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })
    return graph
  }

  test('unbindVariable removes the binding from node', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    expect(graph.getNode(node.id).boundVariables['fills/0/color']).toBe('v1')
    graph.unbindVariable(node.id, 'fills/0/color')
    expect(graph.getNode(node.id).boundVariables['fills/0/color']).toBeUndefined()
  })

  test('unbindVariable emits node:updated event', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    const events: Array<{ nodeId: string; changes: Record<string, unknown> }> = []
    graph.onNodeEvents({
      updated: (nodeId, changes) => events.push({ nodeId, changes })
    })
    graph.unbindVariable(node.id, 'fills/0/color')
    expect(events.length).toBe(1)
    expect(events[0].nodeId).toBe(node.id)
    expect('boundVariables' in events[0].changes).toBe(true)
  })

  test('unbindVariable on non-existent binding is a no-op', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
    // Should not throw when unbinding a field that was never bound
    expect(() => graph.unbindVariable(node.id, 'opacity')).not.toThrow()
  })

  test('unbindVariable does not emit event for non-existent binding', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
    const events: Array<{ nodeId: string; changes: Record<string, unknown> }> = []
    graph.onNodeEvents({
      updated: (nodeId, changes) => events.push({ nodeId, changes })
    })
    graph.unbindVariable(node.id, 'opacity')
    expect(events).toHaveLength(0)
  })
})

// ─── nodeProxyToJSON includes boundVariables ─────────────────────────────

describe('nodeProxyToJSON boundVariables', () => {
  test('nodeProxyToJSON includes boundVariables with resolved info', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1')
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    const api = new FigmaAPI(graph)
    const json = nodeProxyToJSON(graph, api, node.id)
    expect(json.boundVariables).toBeDefined()
    expect(json.boundVariables['fills/0/color']).toBeDefined()
    expect(json.boundVariables['fills/0/color'].variableId).toBe('v1')
    expect(json.boundVariables['fills/0/color'].variableName).toBe('Var v1')
  })

  test('nodeProxyToJSON omits boundVariables when none exist', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
    const api = new FigmaAPI(graph)
    const json = nodeProxyToJSON(graph, api, node.id)
    expect(json.boundVariables).toBeUndefined()
  })
})

// ─── Scope expansion: bindVariable range validation tests ────────────────

describe('bindVariable out-of-range index validation', () => {
  function setupGraph(): SceneGraph {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Colors',
      modes: [{ modeId: 'm1', name: 'Light' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'Primary',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { r: 0.5, g: 0.5, b: 0.5, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })
    return graph
  }

  test('bindVariable rejects index beyond current fills length', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: [
        { type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 },
        { type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    // Node has 2 fills (indices 0, 1). Index 5 is out of range.
    expect(() => {
      graph.bindVariable(node.id, 'fills/5/color', 'v1')
    }).toThrow(/out of range/)
  })

  test('bindVariable rejects next-index binding (index == currentLength)', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: [
        { type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 },
        { type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    // Node has 2 fills (indices 0, 1). Index 2 is out of range (index >= length).
    expect(() => {
      graph.bindVariable(node.id, 'fills/2/color', 'v1')
    }).toThrow(/out of range/)
  })

  test('bindVariable rejects binding to empty fills array (index 0, length 0)', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: []
    })
    // No fills exist. Index 0 is out of range (0 >= 0).
    expect(() => {
      graph.bindVariable(node.id, 'fills/0/color', 'v1')
    }).toThrow(/out of range/)
  })

  test('bindVariable rejects out-of-range stroke index', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })
    // Node has 1 stroke. Index 3 is out of range.
    expect(() => {
      graph.bindVariable(node.id, 'strokes/3/color', 'v1')
    }).toThrow(/out of range/)
  })

  test('bindVariable rejects unknown field names', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
    expect(() => {
      graph.bindVariable(node.id, 'someRandomField', 'v1')
    }).toThrow(/Unknown binding field/)
  })
})

// ─── cleanupStaleBindings handles any indexed sub-path ──────────────────────

describe('cleanupStaleBindings handles any indexed sub-path', () => {
  test('cleans up fills/N/something bindings when fills shrink past the index', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1')
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: [
        { type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 },
        { type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    const n = graph.getNode(node.id)
    // Bind a hypothetical non-color sub-path at index 1
    n.boundVariables['fills/1/somethingElse'] = 'v1'

    // Remove all fills — index 1 is now beyond the array (1 > 0)
    graph.updateNode(node.id, { fills: [] })

    // fills/1/somethingElse binding must be removed (index 1 > length 0)
    expect(n.boundVariables['fills/1/somethingElse']).toBeUndefined()
  })

  test('fills/0/color binding is cleaned up when fills shrink to empty', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1')
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(node.id, 'fills/0/color', 'v1')

    // Shrink fills to empty — fills/0/color must be removed (0 >= 0 is true)
    graph.updateNode(node.id, { fills: [] })
    expect(graph.getNode(node.id).boundVariables['fills/0/color']).toBeUndefined()
  })
})
