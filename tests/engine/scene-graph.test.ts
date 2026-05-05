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
    const node = graph.getNode(id)
    expect(node).toBeDefined()
    expect(node!.type).toBe('RECTANGLE')
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

  test('delete frame recursively deletes children', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page, {
      name: 'F',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    }).id
    const child1 = graph.createNode('RECTANGLE', frame, {
      name: 'C1',
      x: 0,
      y: 0,
      width: 10,
      height: 10
    }).id
    const child2 = graph.createNode('RECTANGLE', frame, {
      name: 'C2',
      x: 20,
      y: 20,
      width: 10,
      height: 10
    }).id

    expect(graph.getNode(frame)).toBeTruthy()
    expect(graph.getNode(child1)).toBeTruthy()
    expect(graph.getNode(child2)).toBeTruthy()

    graph.deleteNode(frame)

    // Frame and all children should be deleted
    expect(graph.getNode(frame)).toBeFalsy()
    expect(graph.getNode(child1)).toBeFalsy()
    expect(graph.getNode(child2)).toBeFalsy()
    // Page should have no children
    expect(graph.getChildren(page)).toHaveLength(0)
  })

  test('delete nested frame deletes all descendants', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const outer = graph.createNode('FRAME', page, {
      name: 'Outer',
      x: 0,
      y: 0,
      width: 300,
      height: 300
    }).id
    const inner = graph.createNode('FRAME', outer, {
      name: 'Inner',
      x: 10,
      y: 10,
      width: 100,
      height: 100
    }).id
    const leaf = graph.createNode('RECTANGLE', inner, {
      name: 'Leaf',
      x: 5,
      y: 5,
      width: 20,
      height: 20
    }).id
    // Another top-level node to verify it survives
    const survivor = rect(graph, 'Survivor')

    graph.deleteNode(outer)

    expect(graph.getNode(outer)).toBeFalsy()
    expect(graph.getNode(inner)).toBeFalsy()
    expect(graph.getNode(leaf)).toBeFalsy()
    expect(graph.getNode(survivor)).toBeTruthy()
    expect(graph.getChildren(page)).toHaveLength(1)
  })

  test('delete instance cleans up instance index', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const comp = graph.createNode('COMPONENT', page, { name: 'Comp', width: 100, height: 40 })
    graph.createNode('RECTANGLE', comp.id, { name: 'BG', width: 100, height: 40 })
    const inst = graph.createInstance(comp.id, page)
    expect(inst).toBeDefined()
    expect(graph.getInstances(comp.id)).toHaveLength(1)

    graph.deleteNode(inst.id)
    expect(graph.getInstances(comp.id)).toHaveLength(0)
  })

  test('delete root is no-op', () => {
    const graph = new SceneGraph()
    const rootId = graph.rootId
    const before = graph.nodes.size
    graph.deleteNode(rootId)
    expect(graph.nodes.size).toBe(before)
  })

  test('reparent into frame', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'F',
      x: 50,
      y: 50,
      width: 400,
      height: 400
    }).id
    const r = rect(graph, 'R', 100, 100)
    graph.reparentNode(r, frame)
    const children = graph.getChildren(frame)
    expect(children.map((c) => c.id)).toContain(r)
  })

  test('reparent to same parent is no-op', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const r = rect(graph, 'R', 100, 200)
    const node = graph.getNode(r)
    expect(node).toBeDefined()
    expect(node!.parentId).toBe(page)
    graph.reparentNode(r, page)
    // Position should not change
    const after = graph.getNode(r)
    expect(after).toBeDefined()
    expect(after!.x).toBe(100)
    expect(after!.y).toBe(200)
    expect(after.parentId).toBe(page)
    expect(graph.getChildren(page)).toHaveLength(1)
  })

  test('reparent preserves absolute position', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'F',
      x: 200,
      y: 100,
      width: 400,
      height: 400
    }).id
    const r = rect(graph, 'R', 300, 150)
    // Node is at (300, 150) absolute on page
    const absBefore = graph.getAbsolutePosition(r)
    expect(absBefore.x).toBe(300)
    expect(absBefore.y).toBe(150)

    graph.reparentNode(r, frame)
    // Now node is inside frame at (200,100), so local coords should be (100, 50)
    const after = graph.getNode(r)
    expect(after).toBeDefined()
    expect(after!.x).toBe(100)
    expect(after.y).toBe(50)
    // Absolute position preserved
    const absAfter = graph.getAbsolutePosition(r)
    expect(absAfter.x).toBe(300)
    expect(absAfter.y).toBe(150)
  })

  test('reparent removes from old parent childIds', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame1 = graph.createNode('FRAME', page, {
      name: 'F1',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    }).id
    const frame2 = graph.createNode('FRAME', page, {
      name: 'F2',
      x: 300,
      y: 0,
      width: 200,
      height: 200
    }).id
    const r = rect(graph, 'R', 10, 10)
    // Move R into F1 first
    graph.reparentNode(r, frame1)
    expect(graph.getChildren(frame1).map((c) => c.id)).toContain(r)
    // Now reparent to F2
    graph.reparentNode(r, frame2)
    expect(graph.getChildren(frame1).map((c) => c.id)).not.toContain(r)
    expect(graph.getChildren(frame2).map((c) => c.id)).toContain(r)
  })

  test('reparent deep hierarchy preserves child positions', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page, {
      name: 'F',
      x: 50,
      y: 50,
      width: 200,
      height: 200
    }).id
    const inner = graph.createNode('FRAME', page, {
      name: 'Inner',
      x: 100,
      y: 100,
      width: 80,
      height: 80
    }).id
    const child = graph.createNode('RECTANGLE', inner, {
      name: 'Child',
      x: 10,
      y: 10,
      width: 20,
      height: 20
    }).id

    // Child is at (110, 110) absolute
    expect(graph.getAbsolutePosition(child)).toEqual({ x: 110, y: 110 })

    // Reparent inner frame into frame F
    graph.reparentNode(inner, frame)

    // Inner was at (100,100), frame is at (50,50), so inner's local = (50,50)
    const innerNode = graph.getNode(inner)
    expect(innerNode).toBeDefined()
    expect(innerNode!.x).toBe(50)
    expect(innerNode.y).toBe(50)
    // Child still at (10,10) relative to inner, absolute = (110,110)
    expect(graph.getAbsolutePosition(child)).toEqual({ x: 110, y: 110 })
  })

  test('children order', () => {
    const graph = new SceneGraph()
    rect(graph, 'A')
    rect(graph, 'B')
    rect(graph, 'C')
    const names = graph.getChildren(pageId(graph)).map((n) => n.name)
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

  test('countDescendants returns 0 for empty page', () => {
    const graph = new SceneGraph()
    expect(graph.countDescendants(pageId(graph))).toBe(0)
  })

  test('countDescendants counts direct children', () => {
    const graph = new SceneGraph()
    rect(graph, 'A')
    rect(graph, 'B')
    rect(graph, 'C')
    expect(graph.countDescendants(pageId(graph))).toBe(3)
  })

  test('countDescendants counts nested descendants recursively', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'F',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    })
    rect(graph, 'Top', 0, 0) // direct child of page
    graph.createNode('RECTANGLE', frame.id, { name: 'Inner1', x: 0, y: 0, width: 10, height: 10 })
    graph.createNode('RECTANGLE', frame.id, { name: 'Inner2', x: 0, y: 0, width: 10, height: 10 })
    // Page has 2 direct children (frame + Top) + frame has 2 children = 4 total
    expect(graph.countDescendants(pageId(graph))).toBe(4)
  })

  test('countDescendants is per-page (multi-page document)', () => {
    const graph = new SceneGraph()
    const page1 = pageId(graph)
    const page2 = graph.addPage('Page 2').id

    // Add 3 nodes to page 1
    rect(graph, 'A')
    rect(graph, 'B')
    rect(graph, 'C')

    // Add 1 node to page 2
    graph.createNode('RECTANGLE', page2, { name: 'D', x: 0, y: 0, width: 10, height: 10 })

    expect(graph.countDescendants(page1)).toBe(3)
    expect(graph.countDescendants(page2)).toBe(1)
    // Total nodes across all pages is 4 + 2 pages + 1 root = 7
    expect(graph.nodes.size).toBe(7)
  })

  test('update node', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'R')
    graph.updateNode(id, { x: 200, name: 'Updated' })
    const node = graph.getNode(id)
    expect(node).toBeDefined()
    expect(node!.x).toBe(200)
    expect(node.name).toBe('Updated')
  })

  test('create instance clones children with componentId mapping', () => {
    const graph = new SceneGraph()
    const comp = graph.createNode('COMPONENT', pageId(graph), {
      name: 'Btn',
      width: 100,
      height: 40
    })
    const child = graph.createNode('RECTANGLE', comp.id, { name: 'BG', width: 100, height: 40 })
    const instance = graph.createInstance(comp.id, pageId(graph))
    expect(instance).toBeDefined()
    expect(instance!.type).toBe('INSTANCE')
    expect(instance.componentId).toBe(comp.id)
    const instChildren = graph.getChildren(instance.id)
    expect(instChildren).toHaveLength(1)
    expect(instChildren[0].componentId).toBe(child.id)
    expect(instChildren[0].name).toBe('BG')
  })

  test('syncInstances propagates changes from component to instance', () => {
    const graph = new SceneGraph()
    const comp = graph.createNode('COMPONENT', pageId(graph), {
      name: 'Card',
      width: 200,
      height: 100
    })
    const label = graph.createNode('TEXT', comp.id, { name: 'Title', text: 'Hello', fontSize: 14 })
    const instance = graph.createInstance(comp.id, pageId(graph))
    expect(instance).toBeDefined()
    const instLabel = graph.getChildren(instance!.id)[0]
    expect(instLabel.text).toBe('Hello')

    graph.updateNode(label.id, { text: 'Updated', fontSize: 18 })
    graph.syncInstances(comp.id)

    expect(instLabel.text).toBe('Updated')
    expect(instLabel.fontSize).toBe(18)
  })

  test('syncInstances preserves overrides', () => {
    const graph = new SceneGraph()
    const comp = graph.createNode('COMPONENT', pageId(graph), {
      name: 'Card',
      width: 200,
      height: 100
    })
    graph.createNode('TEXT', comp.id, { name: 'Title', text: 'Default', fontSize: 14 })
    const instance = graph.createInstance(comp.id, pageId(graph))
    expect(instance).toBeDefined()
    const instLabel = graph.getChildren(instance!.id)[0]

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
    const comp = graph.createNode('COMPONENT', pageId(graph), {
      name: 'Card',
      width: 200,
      height: 100
    })
    graph.createNode('RECTANGLE', comp.id, { name: 'BG' })
    const instance = graph.createInstance(comp.id, pageId(graph))
    expect(instance).toBeDefined()
    expect(graph.getChildren(instance!.id)).toHaveLength(1)

    graph.createNode('TEXT', comp.id, { name: 'Label', text: 'New' })
    graph.syncInstances(comp.id)

    const instChildren = graph.getChildren(instance!.id)
    expect(instChildren).toHaveLength(2)
    expect(instChildren[1].name).toBe('Label')
    expect(instChildren[1].text).toBe('New')
  })

  test('detachInstance breaks link', () => {
    const graph = new SceneGraph()
    const comp = graph.createNode('COMPONENT', pageId(graph), {
      name: 'Btn',
      width: 100,
      height: 40
    })
    graph.createNode('RECTANGLE', comp.id, { name: 'BG' })
    const instance = graph.createInstance(comp.id, pageId(graph))
    expect(instance).toBeDefined()
    expect(instance!.type).toBe('INSTANCE')

    graph.detachInstance(instance!.id)
    expect(instance!.type).toBe('FRAME')
    expect(instance.componentId).toBeNull()
    expect(graph.getInstances(comp.id)).toHaveLength(0)
  })
})

describe('Variables', () => {
  function pageId(graph: SceneGraph): string {
    return graph.getPages()[0]?.id ?? ''
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

  test('missing active mode falls back to default value', () => {
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
      valuesByMode: { light: { r: 1, g: 1, b: 1, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })

    graph.setActiveMode('col1', 'dark')
    expect(graph.resolveColorVariable('v1')).toEqual({ r: 1, g: 1, b: 1, a: 1 })
  })

  test('explicit alias resolution preserves source mode', () => {
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
      id: 'base',
      name: 'base',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: {
        light: { r: 1, g: 1, b: 1, a: 1 },
        dark: { r: 0, g: 0, b: 0, a: 1 }
      },
      description: '',
      hiddenFromPublishing: false
    })
    graph.addVariable({
      id: 'alias',
      name: 'alias',
      type: 'COLOR',
      collectionId: 'col1',
      valuesByMode: {
        light: { aliasId: 'base' },
        dark: { aliasId: 'base' }
      },
      description: '',
      hiddenFromPublishing: false
    })

    expect(graph.resolveVariable('alias', 'dark')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
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
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      fills: []
    })
    expect(graph.hitTest(100, 100, pageId(graph))).toBeNull()
  })

  test('frame with visible fill is hittable', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Filled Frame',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })
    expect(graph.hitTest(100, 100, pageId(graph))?.id).toBe(frame.id)
  })

  test('group returns group on hit, not child (Figma-style)', () => {
    const graph = new SceneGraph()
    const groupId = graph.createNode('GROUP', pageId(graph), {
      name: 'Group',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    }).id
    graph.createNode('RECTANGLE', groupId, {
      name: 'Child',
      x: 10,
      y: 10,
      width: 30,
      height: 30
    })
    // Hit returns group (single click selects group, dblclick enters)
    expect(graph.hitTest(20, 20, pageId(graph))?.id).toBe(groupId)
    // Miss in group's empty area
    expect(graph.hitTest(201, 200, pageId(graph))).toBeNull()
  })

  test('clipsContent prevents hits outside parent bounds', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Clip Frame',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      clipsContent: true,
      fills: []
    })
    const childId = graph.createNode('RECTANGLE', frame.id, {
      name: 'Overflow Child',
      x: 50,
      y: 50,
      width: 200,
      height: 200
    }).id
    // Inside both frame and child — hit
    expect(graph.hitTest(75, 75, pageId(graph))?.id).toBe(childId)
    // Inside child but outside clipping frame — miss
    expect(graph.hitTest(150, 150, pageId(graph))).toBeNull()
  })

  test('instance without fills is click-through in empty area', () => {
    const graph = new SceneGraph()
    const compId = graph.createNode('COMPONENT', pageId(graph), {
      name: 'Comp',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      fills: []
    }).id
    graph.createNode('RECTANGLE', compId, {
      name: 'Inner',
      x: 10,
      y: 10,
      width: 30,
      height: 30
    })
    const instId = graph.createInstance(compId, pageId(graph), { x: 300, y: 0 }).id
    // Hit on instance's child area — returns instance (opaque container)
    expect(graph.hitTest(320, 20, pageId(graph))?.id).toBe(instId)
    // Miss on instance's empty area (no fills)
    expect(graph.hitTest(450, 150, pageId(graph))).toBeNull()
  })

  test('hidden node is not hittable', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rectId = graph.createNode('RECTANGLE', page, {
      name: 'Hidden',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      visible: false
    }).id
    // Hidden nodes should be skipped during hit testing
    expect(graph.hitTest(50, 50, page)).toBeNull()
  })

  test('locked node IS hittable (selection behavior)', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rectId = graph.createNode('RECTANGLE', page, {
      name: 'Locked',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      locked: true
    }).id
    // Locked nodes ARE returned by hit test (selection shows lock icon)
    expect(graph.hitTest(50, 50, page)?.id).toBe(rectId)
  })

  test('zero-opacity node with visible fill IS hittable', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rectId = graph.createNode('RECTANGLE', page, {
      name: 'ZeroOpacity',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      opacity: 0
    }).id
    // Zero opacity does NOT affect hit testing (opacity is a visual property, not a structural one)
    // The fill is "visible: true" which is what hasVisibleFillOrStroke checks
    expect(graph.hitTest(50, 50, page)?.id).toBe(rectId)
  })
})

describe('updateNode', () => {
  test('non-layout change does not clear absPosCache', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rId = rect(graph, 'R', 100, 200)
    // Populate absPosCache by calling getAbsolutePosition
    const absPos = graph.getAbsolutePosition(rId)
    expect(absPos).toEqual({ x: 100, y: 200 })
    // Change fills (non-layout property)
    graph.updateNode(rId, { fills: [] })
    // Cache should still be valid
    const absPos2 = graph.getAbsolutePosition(rId)
    expect(absPos2).toBe(absPos) // same reference = cache hit
  })

  test('layout change clears absPosCache', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rId = rect(graph, 'R', 100, 200)
    const absPos = graph.getAbsolutePosition(rId)
    expect(absPos).toEqual({ x: 100, y: 200 })
    // Change x (layout-affecting property)
    graph.updateNode(rId, { x: 150 })
    const absPos2 = graph.getAbsolutePosition(rId)
    expect(absPos2).toEqual({ x: 150, y: 200 })
    expect(absPos2).not.toBe(absPos) // different reference = cache miss
  })

  test('instance index updated on componentId change', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const comp1 = graph.createNode('COMPONENT', page, {
      name: 'C1',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    const comp2 = graph.createNode('COMPONENT', page, {
      name: 'C2',
      x: 100,
      y: 0,
      width: 50,
      height: 50
    })
    const inst = graph.createInstance(comp1.id, page, { x: 200, y: 0 })
    // Instance should be indexed under comp1
    expect(graph.instanceIndex.get(comp1.id)?.has(inst.id)).toBe(true)
    // Re-point instance to comp2
    graph.updateNode(inst.id, { componentId: comp2.id })
    // Old index entry removed, new one added
    expect(graph.instanceIndex.get(comp1.id)?.has(inst.id)).toBeFalsy()
    expect(graph.instanceIndex.get(comp2.id)?.has(inst.id)).toBe(true)
  })

  test('updateNode on nonexistent node is a no-op', () => {
    const graph = new SceneGraph()
    // Should not throw
    graph.updateNode('nonexistent-id', { x: 100 })
  })

  test('y change clears absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 10, 20)
    const absPos = graph.getAbsolutePosition(rId)
    expect(absPos).toEqual({ x: 10, y: 20 })
    graph.updateNode(rId, { y: 99 })
    const absPos2 = graph.getAbsolutePosition(rId)
    expect(absPos2).toEqual({ x: 10, y: 99 })
    expect(absPos2).not.toBe(absPos)
  })

  test('width change clears absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 10, 20, 50, 50)
    const absPos = graph.getAbsolutePosition(rId)
    graph.updateNode(rId, { width: 200 })
    const absPos2 = graph.getAbsolutePosition(rId)
    expect(absPos2).not.toBe(absPos)
  })

  test('rotation change clears absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 10, 20)
    const absPos = graph.getAbsolutePosition(rId)
    graph.updateNode(rId, { rotation: 45 })
    const absPos2 = graph.getAbsolutePosition(rId)
    expect(absPos2).not.toBe(absPos)
  })

  test('paddingLeft change clears absPosCache', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frameId = graph.createNode('FRAME', page, {
      name: 'F',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    }).id
    const absPos = graph.getAbsolutePosition(frameId)
    graph.updateNode(frameId, { paddingLeft: 20 })
    const absPos2 = graph.getAbsolutePosition(frameId)
    expect(absPos2).not.toBe(absPos)
  })

  test('layoutMode change clears absPosCache', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frameId = graph.createNode('FRAME', page, {
      name: 'F',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    }).id
    const absPos = graph.getAbsolutePosition(frameId)
    graph.updateNode(frameId, { layoutMode: 'HORIZONTAL' as const })
    const absPos2 = graph.getAbsolutePosition(frameId)
    expect(absPos2).not.toBe(absPos)
  })

  test('mixed layout + non-layout change clears absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 10, 20)
    const absPos = graph.getAbsolutePosition(rId)
    // Change both x (layout) and fills (non-layout) simultaneously
    graph.updateNode(rId, { x: 50, fills: [] })
    const absPos2 = graph.getAbsolutePosition(rId)
    expect(absPos2).toEqual({ x: 50, y: 20 })
    expect(absPos2).not.toBe(absPos)
  })

  test('non-layout properties: strokes, opacity, name, visible do not clear absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 10, 20)
    const absPos = graph.getAbsolutePosition(rId)

    graph.updateNode(rId, { strokes: [] })
    expect(graph.getAbsolutePosition(rId)).toBe(absPos)

    graph.updateNode(rId, { opacity: 0.5 })
    expect(graph.getAbsolutePosition(rId)).toBe(absPos)

    graph.updateNode(rId, { name: 'NewName' })
    expect(graph.getAbsolutePosition(rId)).toBe(absPos)

    graph.updateNode(rId, { visible: false })
    expect(graph.getAbsolutePosition(rId)).toBe(absPos)
  })

  test('empty changes object does not clear absPosCache', () => {
    const graph = new SceneGraph()
    const rId = rect(graph, 'R', 10, 20)
    const absPos = graph.getAbsolutePosition(rId)
    graph.updateNode(rId, {})
    expect(graph.getAbsolutePosition(rId)).toBe(absPos)
  })

  test('textPicture is nulled when text properties change on TEXT node', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const textId = graph.createNode('TEXT', page, {
      name: 'T',
      x: 0,
      y: 0,
      width: 100,
      height: 20
    }).id
    const textNode = graph.getNode(textId)
    expect(textNode).toBeDefined()
    // Simulate a cached textPicture
    const fakePicture = new Uint8Array([1, 2, 3])
    textNode!.textPicture = fakePicture

    // Changing fontSize (a TEXT_PICTURE_KEY) should null the cache
    graph.updateNode(textId, { fontSize: 24 })
    const afterUpdate = graph.getNode(textId)
    expect(afterUpdate).toBeDefined()
    expect(afterUpdate!.textPicture).toBeNull()
  })

  test('textPicture survives non-text property change on TEXT node', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const textId = graph.createNode('TEXT', page, {
      name: 'T',
      x: 0,
      y: 0,
      width: 100,
      height: 20
    }).id
    const fakePicture = new Uint8Array([4, 5, 6])
    const textNode = graph.getNode(textId)
    expect(textNode).toBeDefined()
    textNode!.textPicture = fakePicture

    // Changing opacity (NOT a TEXT_PICTURE_KEY) should preserve textPicture
    graph.updateNode(textId, { opacity: 0.5 })
    const afterUpdate = graph.getNode(textId)
    expect(afterUpdate).toBeDefined()
    expect(afterUpdate!.textPicture).toBe(fakePicture)
  })

  test('textPicture is nulled when textPicture is already null', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const textId = graph.createNode('TEXT', page, {
      name: 'T',
      x: 0,
      y: 0,
      width: 100,
      height: 20
    }).id
    // textPicture starts as null — updateNode should not crash
    graph.updateNode(textId, { fontSize: 16 })
    const afterUpdate = graph.getNode(textId)
    expect(afterUpdate).toBeDefined()
    expect(afterUpdate!.textPicture).toBeNull()
  })
})

describe('countDescendants', () => {
  test('nonexistent node returns 0', () => {
    const graph = new SceneGraph()
    expect(graph.countDescendants('nonexistent-id')).toBe(0)
  })

  test('page with 0 children returns 0', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    // Default new graph has an empty page
    expect(graph.countDescendants(page.id)).toBe(0)
  })

  test('counts all descendants recursively', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    // Create a 3-level hierarchy: page → frame → rect, ellipse
    const frame = graph.createNode('FRAME', page, {
      name: 'F',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    }).id
    graph.createNode('RECTANGLE', frame, { name: 'R1', x: 0, y: 0, width: 10, height: 10 })
    graph.createNode('ELLIPSE', frame, { name: 'E1', x: 20, y: 20, width: 10, height: 10 })
    // Page descendants = frame + R1 + E1 = 3
    expect(graph.countDescendants(page)).toBe(3)
    // Frame has 2 descendants
    expect(graph.countDescendants(frame)).toBe(2)
    // Leaf has 0
    const rectId = graph.getChildren(frame)[0].id
    expect(graph.countDescendants(rectId)).toBe(0)
  })

  test('root node count includes all pages and their children', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, 'R1')
    rect(graph, 'R2')
    graph.addPage('Page 2')
    const page2 = graph.getPages()[1].id
    graph.createNode('RECTANGLE', page2, { name: 'R3', x: 0, y: 0, width: 10, height: 10 })
    // Root descendants = Page1 + R1 + R2 + Page2 + R3 = 5
    expect(graph.countDescendants(graph.rootId)).toBe(5)
  })

  test('does not crash on a node with 200k direct children (spread regression)', () => {
    // V8/JSC spread-into-push caps function arguments at ~125k–500k depending on engine
    // and version. Using stack.push(...childIds) inside a loop crashes with
    // RangeError: Maximum call stack size exceeded on real Figma documents.
    // This test guards against the regression introduced in a6122c13.
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page, {
      name: 'BigFrame',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    }).id
    const CHILD_COUNT = 200_000
    // Directly inject children into the node map to avoid O(N^2) createNode overhead
    const frameNode = graph.nodes.get(frame)
    if (!frameNode) throw new Error('frame not found')
    for (let i = 0; i < CHILD_COUNT; i++) {
      const childId = `bulk:${i}`
      graph.nodes.set(childId, {
        ...frameNode,
        id: childId,
        name: `bulk_${i}`,
        type: 'RECTANGLE',
        childIds: [],
        parentId: frame
      })
      frameNode.childIds.push(childId)
    }
    expect(() => graph.countDescendants(frame)).not.toThrow()
    expect(graph.countDescendants(frame)).toBe(CHILD_COUNT)
  })
})

describe('LAYOUT_AFFECTING_KEYS membership', () => {
  test('contains all direct transform properties', () => {
    const keys = SceneGraph.LAYOUT_AFFECTING_KEYS
    for (const k of ['x', 'y', 'width', 'height', 'rotation', 'flipX', 'flipY']) {
      expect(keys.has(k)).toBe(true)
    }
  })

  test('contains all auto-layout properties', () => {
    const keys = SceneGraph.LAYOUT_AFFECTING_KEYS
    for (const k of [
      'layoutMode',
      'layoutDirection',
      'itemSpacing',
      'counterAxisSpacing',
      'paddingLeft',
      'paddingRight',
      'paddingTop',
      'paddingBottom',
      'primaryAxisAlign',
      'counterAxisAlign',
      'counterAxisAlignContent',
      'layoutWrap',
      'primaryAxisSizing',
      'counterAxisSizing',
      'layoutPositioning',
      'layoutGrow',
      'layoutAlignSelf',
      'strokesIncludedInLayout'
    ]) {
      expect(keys.has(k)).toBe(true)
    }
  })

  test('contains grid and sizing constraint properties', () => {
    const keys = SceneGraph.LAYOUT_AFFECTING_KEYS
    for (const k of [
      'gridTemplateColumns',
      'gridTemplateRows',
      'gridColumnGap',
      'gridRowGap',
      'gridPosition',
      'minWidth',
      'maxWidth',
      'minHeight',
      'maxHeight'
    ]) {
      expect(keys.has(k)).toBe(true)
    }
  })

  test('does NOT contain visual-only properties', () => {
    const keys = SceneGraph.LAYOUT_AFFECTING_KEYS
    for (const k of ['fills', 'strokes', 'effects', 'opacity', 'visible', 'name', 'pluginData']) {
      expect(keys.has(k)).toBe(false)
    }
  })

  test('has exactly the expected number of keys', () => {
    // x,y,width,height,rotation,flipX,flipY = 7
    // layoutMode,layoutDirection,itemSpacing,counterAxisSpacing = 4
    // paddingLeft,paddingRight,paddingTop,paddingBottom = 4
    // primaryAxisAlign,counterAxisAlign,counterAxisAlignContent = 3
    // layoutWrap,primaryAxisSizing,counterAxisSizing = 3
    // layoutPositioning,layoutGrow,layoutAlignSelf,strokesIncludedInLayout = 4
    // horizontalConstraint,verticalConstraint = 2
    // gridTemplateColumns,gridTemplateRows,gridColumnGap,gridRowGap,gridPosition = 5
    // minWidth,maxWidth,minHeight,maxHeight = 4
    // Total: 36
    expect(SceneGraph.LAYOUT_AFFECTING_KEYS.size).toBe(36)
  })
})

describe('TEXT_PICTURE_KEYS membership', () => {
  test('contains text rendering properties', () => {
    const keys = SceneGraph.TEXT_PICTURE_KEYS
    for (const k of [
      'text',
      'fontSize',
      'fontFamily',
      'fontWeight',
      'italic',
      'textAlignHorizontal',
      'textDirection',
      'textAlignVertical',
      'lineHeight',
      'letterSpacing',
      'textDecoration',
      'textCase',
      'styleRuns',
      'fills',
      'width',
      'height'
    ]) {
      expect(keys.has(k)).toBe(true)
    }
  })

  test('does NOT contain non-text properties', () => {
    const keys = SceneGraph.TEXT_PICTURE_KEYS
    for (const k of ['x', 'y', 'rotation', 'opacity', 'visible', 'name']) {
      expect(keys.has(k)).toBe(false)
    }
  })
})
