import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import noHardcodedColors from '@open-pencil/core/lint/rules/no-hardcoded-colors'

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

// ─── bindVariable emits node:updated event ──────────────────────────────────

describe('bindVariable emits node:updated event', () => {
  test('bindVariable emits node:updated event', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1')
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })

    const events: Array<{ nodeId: string; changes: Record<string, unknown> }> = []
    graph.onNodeEvents({
      updated: (nodeId, changes) => {
        events.push({ nodeId, changes })
      }
    })

    graph.bindVariable(node.id, 'fills/0/color', 'v1')

    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events[0].nodeId).toBe(node.id)
    expect(events[0].changes).toHaveProperty('boundVariables')
  })
})

// ─── no-hardcoded-colors lint checks indexed bindings ──────────────────────

describe('no-hardcoded-colors lint checks indexed bindings', () => {
  test('node with fills/0/color binding passes lint (no false positive)', () => {
    const node = {
      id: 'n1',
      name: 'Rect',
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      rotation: 0,
      visible: true,
      locked: false,
      layoutMode: 'NONE',
      itemSpacing: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      cornerRadius: 0,
      childIds: [],
      text: '',
      fontSize: 14,
      styleRunCount: 0,
      boundVariables: { 'fills/0/color': 'v1' },
      fills: [{ type: 'SOLID', visible: true, opacity: 1, color: { r: 0.5, g: 0.5, b: 0.5 } }],
      strokes: [],
      effects: []
    }

    const messages: Array<{ message: string }> = []
    const context = {
      report: (issue: { message: string }) => messages.push(issue),
      getConfig: () => ({}),
      getParent: () => null,
      getChildren: () => []
    }

    noHardcodedColors.check(node, context)
    // Should NOT report a violation — the color is bound to a variable
    expect(messages.length).toBe(0)
  })

  test('node with top-level fills binding still reports violation (no false negative)', () => {
    const node = {
      id: 'n2',
      name: 'Rect',
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      rotation: 0,
      visible: true,
      locked: false,
      layoutMode: 'NONE',
      itemSpacing: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      cornerRadius: 0,
      childIds: [],
      text: '',
      fontSize: 14,
      styleRunCount: 0,
      boundVariables: { fills: 'v1' }, // top-level — renderer-ignored
      fills: [{ type: 'SOLID', visible: true, opacity: 1, color: { r: 0.5, g: 0.5, b: 0.5 } }],
      strokes: [],
      effects: []
    }

    const messages: Array<{ message: string }> = []
    const context = {
      report: (issue: { message: string }) => messages.push(issue),
      getConfig: () => ({}),
      getParent: () => null,
      getChildren: () => []
    }

    noHardcodedColors.check(node, context)
    // SHOULD report a violation — top-level 'fills' binding is renderer-ignored
    expect(messages.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── bindVariable validation ──────────────────────────────────────────────

describe('bindVariable validation', () => {
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
      id: 'v-color',
      name: 'Primary',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
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

  test('bindVariable rejects nonexistent variable', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
    expect(() => {
      graph.bindVariable(node.id, 'fills/0/color', 'nonexistent')
    }).toThrow()
    expect(graph.getNode(node.id).boundVariables['fills/0/color']).toBeUndefined()
  })

  test('bindVariable rejects FLOAT variable on color field', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
    expect(() => {
      graph.bindVariable(node.id, 'fills/0/color', 'v-float')
    }).toThrow()
    expect(graph.getNode(node.id).boundVariables['fills/0/color']).toBeUndefined()
  })

  test('bindVariable rejects COLOR variable on scalar field', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
    expect(() => {
      graph.bindVariable(node.id, 'opacity', 'v-color')
    }).toThrow()
    expect(graph.getNode(node.id).boundVariables['opacity']).toBeUndefined()
  })

  test('bindVariable allows pre-binding to fills that do not yet exist', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
    // Rect has 0 fills, but we can still set a binding for a fill that will be added later
    expect(() => {
      graph.bindVariable(node.id, 'fills/0/color', 'v-color')
    }).not.toThrow()
    expect(graph.getNode(node.id).boundVariables['fills/0/color']).toBe('v-color')
  })

  test('bindVariable auto-removes top-level fills binding when indexed binding is set', () => {
    const graph = setupGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, visible: true, opacity: 1 }]
    })
    const n = graph.getNode(node.id)
    // Set top-level dead data first
    n.boundVariables['fills'] = 'v-color'
    // Now set a proper indexed binding — should auto-remove top-level
    graph.bindVariable(node.id, 'fills/0/color', 'v-color')
    expect(n.boundVariables['fills']).toBeUndefined()
    expect(n.boundVariables['fills/0/color']).toBe('v-color')
  })
})
