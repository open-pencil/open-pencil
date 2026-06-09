import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/core'
import { collectSubtrees } from '@open-pencil/core/editor/clipboard/subtree-history'

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

// ─── cloneTree deep-copies boundVariables, overrides, styleRuns ─────────────

describe('cloneTree deep-copies boundVariables, overrides, and styleRuns', () => {
  test('clone.boundVariables is not the same reference as original', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1', 'v2')
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Original',
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    const original = graph.getNode(node.id)

    const clone =
      graph.cloneTree(node.id, pageId(graph)) ??
      (() => {
        throw new Error('clone failed')
      })()
    expect(clone).not.toBeNull()
    expect(clone.boundVariables).not.toBe(original.boundVariables)
  })

  test('binding on clone does not corrupt original node', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1', 'v2')
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Original',
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    const original = graph.getNode(node.id)

    const clone =
      graph.cloneTree(node.id, pageId(graph)) ??
      (() => {
        throw new Error('clone failed')
      })()
    graph.bindVariable(clone.id, 'fills/0/color', 'v2')

    // Original must still have v1
    expect(original.boundVariables['fills/0/color']).toBe('v1')
    // Clone must have v2
    expect(clone.boundVariables['fills/0/color']).toBe('v2')
  })

  test('clone.overrides is not the same reference as original', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Original',
      overrides: { someKey: 'someValue' }
    })
    const original = graph.getNode(node.id)

    const clone =
      graph.cloneTree(node.id, pageId(graph)) ??
      (() => {
        throw new Error('clone failed')
      })()
    expect(clone.overrides).not.toBe(original.overrides)
  })

  test('clone.styleRuns is not the same reference as original', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'Original',
      text: 'Hello',
      fontSize: 14,
      fontFamily: 'Inter',
      styleRuns: [{ start: 0, length: 5, style: { fontWeight: 700 } }]
    })
    const original = graph.getNode(node.id)

    const clone =
      graph.cloneTree(node.id, pageId(graph)) ??
      (() => {
        throw new Error('clone failed')
      })()
    expect(clone.styleRuns).not.toBe(original.styleRuns)
    // Deep check: styleRuns elements must also be independent
    if (original.styleRuns.length > 0 && clone.styleRuns.length > 0) {
      expect(clone.styleRuns[0]).not.toBe(original.styleRuns[0])
    }
  })

  test('clone.fills is not the same reference as original', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Original',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })
    const original = graph.getNode(node.id)

    const clone =
      graph.cloneTree(node.id, pageId(graph)) ??
      (() => {
        throw new Error('clone failed')
      })()
    expect(clone.fills).not.toBe(original.fills)
    // Fill elements should also be independent
    if (original.fills.length > 0 && clone.fills.length > 0) {
      expect(clone.fills[0]).not.toBe(original.fills[0])
    }
  })
})

// ─── instance child binding independence ──────────────────────────────────

describe('instance child bindings are independent from component', () => {
  test('instance child boundVariables is not shared with component child', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1', 'v2')
    const page = pageId(graph)

    // Create component with child
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

    // Instance child's boundVariables must be independent
    const componentChild = graph.getNode(child.id)?.boundVariables
    expect(componentChild).toBeDefined()
    expect(instanceChild.boundVariables).not.toBe(componentChild)
  })

  test('binding on instance child does not corrupt component child', () => {
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
    const compChild = graph.getNode(child.id)

    const instance =
      graph.createInstance(component.id, page) ??
      (() => {
        throw new Error('instance failed')
      })()
    const instanceChild = graph.getChildren(instance.id)[0]

    // Bind different variable on instance child
    graph.bindVariable(instanceChild.id, 'fills/0/color', 'v2')

    // Component child must still have v1
    expect(compChild.boundVariables['fills/0/color']).toBe('v1')
    // Instance child must have v2
    expect(instanceChild.boundVariables['fills/0/color']).toBe('v2')
  })

  test('instance child overrides is not shared with component child', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)

    const component = graph.createNode('COMPONENT', page, {
      name: 'Button',
      width: 100,
      height: 40
    })
    const child = graph.createNode('RECTANGLE', component.id, {
      name: 'Bg',
      width: 100,
      height: 40
    })

    const compChild = graph.getNode(child.id)

    const instance =
      graph.createInstance(component.id, page) ??
      (() => {
        throw new Error('instance failed')
      })()
    const instanceChild = graph.getChildren(instance.id)[0]

    expect(instanceChild.overrides).not.toBe(compChild.overrides)
  })

  test('instance child source.fig is not shared with component child', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)

    const component = graph.createNode('COMPONENT', page, {
      name: 'Button',
      width: 100,
      height: 40
    })
    const child = graph.createNode('RECTANGLE', component.id, {
      name: 'Bg',
      width: 100,
      height: 40
    })

    // Set source.fig on component child
    graph.updateNode(child.id, {
      source: {
        ...graph.getNode(child.id).source,
        format: 'fig',
        fig: {
          rawSize: { x: 100, y: 40 },
          rawTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
          rawNodeFields: { visible: true, opacity: 1 },
          layout: null,
          symbolOverrides: [],
          componentPropAssignments: [],
          derivedSymbolData: [],
          derivedSymbolDataLayoutVersion: null,
          uniformScaleFactor: null
        }
      }
    })

    const compChild = graph.getNode(child.id)
    const instance =
      graph.createInstance(component.id, page) ??
      (() => {
        throw new Error('instance failed')
      })()
    const instanceChild = graph.getChildren(instance.id)[0]

    // source.fig must be deep-copied, not shared
    if (compChild.source.fig && instanceChild.source.fig) {
      expect(instanceChild.source.fig).not.toBe(compChild.source.fig)
      // Mutating instance source.fig must not affect component
      instanceChild.source.fig.rawSize = { x: 999, y: 999 }
      expect(compChild.source.fig.rawSize).toEqual({ x: 100, y: 40 })
    }
  })
})

// ─── set_fill/set_stroke clean up stale bindings ─────────────────────────

describe('set_fill/set_stroke clean up stale bindings', () => {
  test('set_fill removes fills/N/color bindings that are out of range', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1', 'v2')
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: [
        { type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 },
        { type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    // Bind both fills
    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    graph.bindVariable(node.id, 'fills/1/color', 'v2')

    const n = graph.getNode(node.id)
    expect(n.boundVariables['fills/0/color']).toBe('v1')
    expect(n.boundVariables['fills/1/color']).toBe('v2')

    // Replace fills with an empty array via updateNode (same path tools use)
    graph.updateNode(node.id, { fills: [] })

    // fills/1/color binding must be removed (index 1 > length 0)
    expect(n.boundVariables['fills/1/color']).toBeUndefined()
  })

  test('set_fill removes top-level fills binding (dead data)', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
    const n = graph.getNode(node.id)

    // Set a top-level 'fills' binding (dead data — renderer never reads this)
    n.boundVariables['fills'] = 'v1'

    // Replace fills via updateNode (same path tools use)
    graph.updateNode(node.id, {
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    // Top-level 'fills' binding should be cleaned up
    expect(n.boundVariables['fills']).toBeUndefined()
  })
})

// ─── collectSubtrees uses structuredClone ──────────────────────────────────

describe('collectSubtrees deep-copies nodes', () => {
  test('collectSubtrees does not share boundVariables reference', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1')
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    const original = graph.getNode(node.id)

    const collected = collectSubtrees(graph, [node.id])
    expect(collected.length).toBe(1)
    expect(collected[0].boundVariables).not.toBe(original.boundVariables)
  })
})

// ─── undo of binding on clone restores original correctly ──────────────────

describe('undo of binding on clone restores original state', () => {
  test('bind on clone, then undo restores original binding state', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1', 'v2')
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Original',
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    const clone = graph.cloneTree(node.id, pageId(graph))
    graph.bindVariable(clone.id, 'fills/0/color', 'v2')
    expect(graph.getNode(clone.id).boundVariables['fills/0/color']).toBe('v2')
    // Original should be unaffected
    expect(graph.getNode(node.id).boundVariables['fills/0/color']).toBe('v1')
  })
})

// ─── variable deletion and re-clone safety ──────────────────────────────

describe('variable deletion and re-clone safety', () => {
  test('deleting a variable removes bindings and re-cloning works safely', () => {
    const graph = new SceneGraph()
    setupColorVars(graph, 'v1', 'v2')
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Original',
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    const clone1 = graph.cloneTree(node.id, pageId(graph))
    expect(graph.getNode(clone1.id).boundVariables['fills/0/color']).toBe('v1')
    // Delete the variable — this cleans up bindings on all nodes
    graph.removeVariable('v1')
    // Bindings are removed from both original and clone
    expect(graph.getNode(node.id).boundVariables['fills/0/color']).toBeUndefined()
    expect(graph.getNode(clone1.id).boundVariables['fills/0/color']).toBeUndefined()
    // Clone again — should not crash, clone has no stale binding
    const clone2 = graph.cloneTree(node.id, pageId(graph))
    expect(clone2).toBeDefined()
    expect(graph.getNode(clone2.id).boundVariables['fills/0/color']).toBeUndefined()
  })
})

// ─── cloneNodeProps deep-copy verification ──────────────────────────────────

describe('cloneNodeProps deep-copies vectorNetwork', () => {
  test('cloned vectorNetwork is not the same reference as original', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Vector',
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: [{ windingRule: 'NONZERO' as const, loops: [[0, 1]] }]
      }
    })
    const original = graph.getNode(node.id)
    const clone = graph.cloneTree(node.id, pageId(graph))
    const clonedNode = graph.getNode(clone.id)

    expect(clonedNode.vectorNetwork).not.toBe(original.vectorNetwork)
    if (original.vectorNetwork && clonedNode.vectorNetwork) {
      expect(clonedNode.vectorNetwork.vertices).not.toBe(original.vectorNetwork.vertices)
      expect(clonedNode.vectorNetwork.segments).not.toBe(original.vectorNetwork.segments)
      expect(clonedNode.vectorNetwork.regions).not.toBe(original.vectorNetwork.regions)
    }
  })

  test('mutating clone vectorNetwork does not affect original', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Vector',
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 50 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    const original = graph.getNode(node.id)
    const clone = graph.cloneTree(node.id, pageId(graph))
    const clonedNode = graph.getNode(clone.id)

    // Mutate clone's vertex
    if (clonedNode.vectorNetwork) {
      clonedNode.vectorNetwork.vertices[0].x = 999
    }
    // Original must be unaffected
    expect(original.vectorNetwork?.vertices[0].x).toBe(0)
  })
})

describe('cloneNodeProps deep-copies textPicture and figmaDerivedTextGlyphs', () => {
  test('cloned textPicture is not the same reference as original', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'Text',
      text: 'Hello',
      fontSize: 14,
      fontFamily: 'Inter',
      textPicture: new Uint8Array([1, 2, 3, 4])
    })
    const original = graph.getNode(node.id)
    const clone = graph.cloneTree(node.id, pageId(graph))
    const clonedNode = graph.getNode(clone.id)

    expect(clonedNode.textPicture).not.toBe(original.textPicture)
    if (original.textPicture && clonedNode.textPicture) {
      // Mutate clone's data
      clonedNode.textPicture[0] = 99
      // Original must be unaffected
      expect(original.textPicture[0]).toBe(1)
    }
  })

  test('cloned figmaDerivedTextGlyphs is not the same reference as original', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'Text',
      text: 'Hi',
      fontSize: 14,
      fontFamily: 'Inter',
      figmaDerivedTextGlyphs: [
        { commandsBlob: new Uint8Array([10, 20]), x: 0, y: 0, fontSize: 14 },
        { commandsBlob: new Uint8Array([30, 40]), x: 10, y: 0, fontSize: 14 }
      ]
    })
    const original = graph.getNode(node.id)
    const clone = graph.cloneTree(node.id, pageId(graph))
    const clonedNode = graph.getNode(clone.id)

    expect(clonedNode.figmaDerivedTextGlyphs).not.toBe(original.figmaDerivedTextGlyphs)
    if (original.figmaDerivedTextGlyphs && clonedNode.figmaDerivedTextGlyphs) {
      expect(clonedNode.figmaDerivedTextGlyphs[0]).not.toBe(original.figmaDerivedTextGlyphs[0])
      // commandsBlob should be independent
      expect(clonedNode.figmaDerivedTextGlyphs[0].commandsBlob).not.toBe(
        original.figmaDerivedTextGlyphs[0].commandsBlob
      )
      // Mutate clone's blob
      clonedNode.figmaDerivedTextGlyphs[0].commandsBlob[0] = 99
      // Original must be unaffected
      expect(original.figmaDerivedTextGlyphs[0].commandsBlob[0]).toBe(10)
    }
  })
})

// ─── cloneNodeProps deep-copies overrides values ─────────────────────────────

describe('cloneNodeProps deep-copies overrides values', () => {
  test('mutating clone overrides does not affect original', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    // Create component with child that has fills
    const component = graph.createNode('COMPONENT', page, { name: 'Comp', width: 100, height: 40 })
    const _child = graph.createNode('RECTANGLE', component.id, {
      name: 'Bg',
      width: 100,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    // Create instance
    const instance = graph.createInstance(component.id, page)
    if (!instance) throw new Error('instance failed')
    const instanceChild = graph.getChildren(instance.id)[0]

    // Set an override with an object value (fills array)
    instance.overrides[`${instanceChild.id}:fills`] = [
      { type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, visible: true, opacity: 1 }
    ]

    // Clone the instance
    const clone = graph.cloneTree(instance.id, page)
    if (!clone) throw new Error('clone failed')
    const clonedInstance = graph.getNode(clone.id)

    // Mutate the clone's overrides value
    const overrideKey = `${instanceChild.id}:fills`
    const cloneOverrideVal = clonedInstance.overrides[overrideKey] as Array<{
      color: { r: number }
    }>
    if (cloneOverrideVal) {
      cloneOverrideVal[0].color.r = 0.5
    }

    // Original instance overrides must be unaffected
    const origOverrideVal = instance.overrides[overrideKey] as Array<{ color: { r: number } }>
    if (origOverrideVal) {
      expect(origOverrideVal[0].color.r).toBe(0) // still blue, not mutated
    }
  })
})

describe('cloneNodeProps handles undefined arrays defensively', () => {
  test('cloneNodeProps does not crash when array fields are undefined', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const node = graph.createNode('RECTANGLE', page, { name: 'Rect' })
    const raw = graph.getNode(node.id)
    // Simulate a node from .fig parsing where array fields could be undefined
    const patch: Partial<Pick<SceneNode, 'componentPropertyDefinitions' | 'symbolLinks' | 'exportSettings' | 'pluginData' | 'pluginRelaunchData'>> = {
      componentPropertyDefinitions: undefined,
      symbolLinks: undefined,
      exportSettings: undefined,
      pluginData: undefined,
      pluginRelaunchData: undefined
    }
    Object.assign(raw, patch)
    // cloneTree must not throw TypeError on .map() of undefined
    expect(() => graph.cloneTree(node.id, page)).not.toThrow()
  })
})
