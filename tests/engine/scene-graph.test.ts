import { describe, test, expect } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function rect(graph: SceneGraph, name: string, x = 0, y = 0, w = 50, h = 50) {
  return graph.createNode('RECTANGLE', pageId(graph), { name, x, y, width: w, height: h }).id
}

describe('SceneGraph', () => {
  test('create rectangle', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'Rect', 100, 100, 200, 150)
    const node = graph.getNode(id)!
    expect(node.type).toBe('RECTANGLE')
    expect(node.x).toBe(100)
    expect(node.width).toBe(200)
  })

  test('create and delete', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'R')
    expect(graph.getNode(id)).toBeTruthy()
    graph.deleteNode(id)
    expect(graph.getNode(id)).toBeFalsy()
  })

  test('reparent into frame', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { name: 'F', x: 50, y: 50, width: 400, height: 400 }).id
    const r = rect(graph, 'R', 100, 100)
    graph.reparentNode(r, frame)
    const children = graph.getChildren(frame)
    expect(children.map(c => c.id)).toContain(r)
  })

  test('children order', () => {
    const graph = new SceneGraph()
    rect(graph, 'A')
    rect(graph, 'B')
    rect(graph, 'C')
    const names = graph.getChildren(pageId(graph)).map(n => n.name)
    expect(names).toEqual(['A', 'B', 'C'])
  })

  test('pages', () => {
    const graph = new SceneGraph()
    expect(graph.getPages()).toHaveLength(1)
    expect(graph.getPages()[0].name).toBe('Page 1')
    const page2 = graph.addPage('Page 2')
    expect(graph.getPages()).toHaveLength(2)
    expect(page2.name).toBe('Page 2')
    rect(graph, 'Shape', 0, 0, 50, 50)
    expect(graph.getChildren(pageId(graph))).toHaveLength(1)
    expect(graph.getChildren(page2.id)).toHaveLength(0)
  })

  test('update node', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'R')
    graph.updateNode(id, { x: 200, name: 'Updated' })
    const node = graph.getNode(id)!
    expect(node.x).toBe(200)
    expect(node.name).toBe('Updated')
  })

  test('create instance clones children with componentId mapping', () => {
    const graph = new SceneGraph()
    const comp = graph.createNode('COMPONENT', pageId(graph), { name: 'Btn', width: 100, height: 40 })
    const child = graph.createNode('RECTANGLE', comp.id, { name: 'BG', width: 100, height: 40 })
    const instance = graph.createInstance(comp.id, pageId(graph))!
    expect(instance.type).toBe('INSTANCE')
    expect(instance.componentId).toBe(comp.id)
    const instChildren = graph.getChildren(instance.id)
    expect(instChildren).toHaveLength(1)
    expect(instChildren[0].componentId).toBe(child.id)
    expect(instChildren[0].name).toBe('BG')
  })

  test('syncInstances propagates changes from component to instance', () => {
    const graph = new SceneGraph()
    const comp = graph.createNode('COMPONENT', pageId(graph), { name: 'Card', width: 200, height: 100 })
    const label = graph.createNode('TEXT', comp.id, { name: 'Title', text: 'Hello', fontSize: 14 })
    const instance = graph.createInstance(comp.id, pageId(graph))!
    const instLabel = graph.getChildren(instance.id)[0]
    expect(instLabel.text).toBe('Hello')

    graph.updateNode(label.id, { text: 'Updated', fontSize: 18 })
    graph.syncInstances(comp.id)

    expect(instLabel.text).toBe('Updated')
    expect(instLabel.fontSize).toBe(18)
  })

  test('syncInstances preserves overrides', () => {
    const graph = new SceneGraph()
    const comp = graph.createNode('COMPONENT', pageId(graph), { name: 'Card', width: 200, height: 100 })
    graph.createNode('TEXT', comp.id, { name: 'Title', text: 'Default', fontSize: 14 })
    const instance = graph.createInstance(comp.id, pageId(graph))!
    const instLabel = graph.getChildren(instance.id)[0]

    // Override the text on the instance child
    graph.updateNode(instLabel.id, { text: 'Custom' })
    instance.overrides[`${instLabel.id}:text`] = 'Custom'

    // Change component
    graph.updateNode(graph.getChildren(comp.id)[0].id, { text: 'New Default', fontSize: 20 })
    graph.syncInstances(comp.id)

    // Text preserved (overridden), fontSize synced (not overridden)
    expect(instLabel.text).toBe('Custom')
    expect(instLabel.fontSize).toBe(20)
  })

  test('syncInstances adds new children from component', () => {
    const graph = new SceneGraph()
    const comp = graph.createNode('COMPONENT', pageId(graph), { name: 'Card', width: 200, height: 100 })
    graph.createNode('RECTANGLE', comp.id, { name: 'BG' })
    const instance = graph.createInstance(comp.id, pageId(graph))!
    expect(graph.getChildren(instance.id)).toHaveLength(1)

    graph.createNode('TEXT', comp.id, { name: 'Label', text: 'New' })
    graph.syncInstances(comp.id)

    const instChildren = graph.getChildren(instance.id)
    expect(instChildren).toHaveLength(2)
    expect(instChildren[1].name).toBe('Label')
    expect(instChildren[1].text).toBe('New')
  })

  test('detachInstance breaks link', () => {
    const graph = new SceneGraph()
    const comp = graph.createNode('COMPONENT', pageId(graph), { name: 'Btn', width: 100, height: 40 })
    graph.createNode('RECTANGLE', comp.id, { name: 'BG' })
    const instance = graph.createInstance(comp.id, pageId(graph))!
    expect(instance.type).toBe('INSTANCE')

    graph.detachInstance(instance.id)
    expect(instance.type).toBe('FRAME')
    expect(instance.componentId).toBeNull()
    expect(graph.getInstances(comp.id)).toHaveLength(0)
  })
})

describe('Variables', () => {
  function pageId(graph: SceneGraph): string {
    return graph.getPages()[0]!.id
  }

  test('add and resolve color variable', () => {
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
      valuesByMode: { m1: { r: 0, g: 0.5, b: 1, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })

    const color = graph.resolveColorVariable('v1')
    expect(color).toEqual({ r: 0, g: 0.5, b: 1, a: 1 })
  })

  test('resolve number variable', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Spacing',
      modes: [{ modeId: 'm1', name: 'Default' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'spacing/md',
      type: 'FLOAT',
      collectionId: 'col1',
      valuesByMode: { m1: 16 },
      description: '',
      hiddenFromPublishing: false
    })

    expect(graph.resolveNumberVariable('v1')).toBe(16)
  })

  test('resolve alias variable', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Tokens',
      modes: [{ modeId: 'm1', name: 'Light' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'Blue/500',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { r: 0, g: 0, b: 1, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })
    graph.addVariable({
      id: 'v2',
      name: 'Primary',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { aliasId: 'v1' } },
      description: '',
      hiddenFromPublishing: false
    })

    expect(graph.resolveColorVariable('v2')).toEqual({ r: 0, g: 0, b: 1, a: 1 })
  })

  test('mode switching changes resolved value', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Theme',
      modes: [
        { modeId: 'light', name: 'Light' },
        { modeId: 'dark', name: 'Dark' }
      ],
      defaultModeId: 'light',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'bg',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: {
        light: { r: 1, g: 1, b: 1, a: 1 },
        dark: { r: 0, g: 0, b: 0, a: 1 }
      },
      description: '',
      hiddenFromPublishing: false
    })

    expect(graph.resolveColorVariable('v1')).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    graph.setActiveMode('col1', 'dark')
    expect(graph.resolveColorVariable('v1')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  test('bind and unbind variable to node', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })

    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    expect(node.boundVariables['fills/0/color']).toBe('v1')

    graph.unbindVariable(node.id, 'fills/0/color')
    expect(node.boundVariables['fills/0/color']).toBeUndefined()
  })

  test('removing variable cleans up bindings', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Colors',
      modes: [{ modeId: 'm1', name: 'Default' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'Red',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })

    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
    graph.bindVariable(node.id, 'fills/0/color', 'v1')
    expect(node.boundVariables['fills/0/color']).toBe('v1')

    graph.removeVariable('v1')
    expect(node.boundVariables['fills/0/color']).toBeUndefined()
    expect(graph.variables.size).toBe(0)
  })

  test('circular alias does not infinite loop', () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'col1',
      name: 'Test',
      modes: [{ modeId: 'm1', name: 'Default' }],
      defaultModeId: 'm1',
      variableIds: []
    })
    graph.addVariable({
      id: 'v1',
      name: 'A',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { aliasId: 'v2' } },
      description: '',
      hiddenFromPublishing: false
    })
    graph.addVariable({
      id: 'v2',
      name: 'B',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: { m1: { aliasId: 'v1' } },
      description: '',
      hiddenFromPublishing: false
    })

    expect(graph.resolveColorVariable('v1')).toBeUndefined()
  })
})

describe('hitTest', () => {
  test('hits a rectangle', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'R', 10, 10, 50, 50)
    expect(graph.hitTest(35, 35, pageId(graph))?.id).toBe(id)
  })

  test('misses empty space', () => {
    const graph = new SceneGraph()
    rect(graph, 'R', 10, 10, 50, 50)
    expect(graph.hitTest(200, 200, pageId(graph))).toBeNull()
  })

  test('frame without fills is click-through', () => {
    const graph = new SceneGraph()
    graph.createNode('FRAME', pageId(graph), {
      name: 'Empty Frame',
      x: 0, y: 0, width: 200, height: 200, fills: [],
    })
    expect(graph.hitTest(100, 100, pageId(graph))).toBeNull()
  })

  test('frame with visible fill is hittable', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Filled Frame',
      x: 0, y: 0, width: 200, height: 200,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }],
    })
    expect(graph.hitTest(100, 100, pageId(graph))?.id).toBe(frame.id)
  })

  test('group returns group on hit, not child (Figma-style)', () => {
    const graph = new SceneGraph()
    const groupId = graph.createNode('GROUP', pageId(graph), {
      name: 'Group', x: 0, y: 0, width: 200, height: 200,
    }).id
    graph.createNode('RECTANGLE', groupId, {
      name: 'Child', x: 10, y: 10, width: 30, height: 30,
    })
    // Hit returns group (single click selects group, dblclick enters)
    expect(graph.hitTest(20, 20, pageId(graph))?.id).toBe(groupId)
    // Miss in group's empty area
    expect(graph.hitTest(150, 150, pageId(graph))).toBeNull()
  })

  test('clipsContent prevents hits outside parent bounds', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Clip Frame', x: 0, y: 0, width: 100, height: 100,
      clipsContent: true, fills: [],
    })
    const childId = graph.createNode('RECTANGLE', frame.id, {
      name: 'Overflow Child', x: 50, y: 50, width: 200, height: 200,
    }).id
    // Inside both frame and child — hit
    expect(graph.hitTest(75, 75, pageId(graph))?.id).toBe(childId)
    // Inside child but outside clipping frame — miss
    expect(graph.hitTest(150, 150, pageId(graph))).toBeNull()
  })

  test('instance without fills is click-through in empty area', () => {
    const graph = new SceneGraph()
    const compId = graph.createNode('COMPONENT', pageId(graph), {
      name: 'Comp', x: 0, y: 0, width: 200, height: 200, fills: [],
    }).id
    graph.createNode('RECTANGLE', compId, {
      name: 'Inner', x: 10, y: 10, width: 30, height: 30,
    })
    const instId = graph.createInstance(compId, pageId(graph), { x: 300, y: 0 }).id
    // Hit on instance's child area — returns instance (opaque container)
    expect(graph.hitTest(320, 20, pageId(graph))?.id).toBe(instId)
    // Miss on instance's empty area (no fills)
    expect(graph.hitTest(450, 150, pageId(graph))).toBeNull()
  })
})
