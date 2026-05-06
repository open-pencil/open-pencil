import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

import { pageId, rect } from './helpers'

describe('SceneGraph', () => {
  test('create rectangle', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'Rect', 100, 100, 200, 150)
    const node = graph.getNode(id)
    expect(node).toBeDefined()
    expect(expectDefined(node, 'node').type).toBe('RECTANGLE')
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
    expect(expectDefined(node, 'node').parentId).toBe(page)
    graph.reparentNode(r, page)
    // Position should not change
    const after = graph.getNode(r)
    expect(after).toBeDefined()
    expect(expectDefined(after, 'updated node').x).toBe(100)
    expect(expectDefined(after, 'updated node').y).toBe(200)
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
    expect(expectDefined(after, 'updated node').x).toBe(100)
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
    expect(expectDefined(innerNode, 'inner node').x).toBe(50)
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
    expect(expectDefined(node, 'node').x).toBe(200)
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
    expect(expectDefined(instance, 'instance').type).toBe('INSTANCE')
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
    const instLabel = graph.getChildren(expectDefined(instance, 'instance').id)[0]
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
    const instLabel = graph.getChildren(expectDefined(instance, 'instance').id)[0]

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
    expect(graph.getChildren(expectDefined(instance, 'instance').id)).toHaveLength(1)

    graph.createNode('TEXT', comp.id, { name: 'Label', text: 'New' })
    graph.syncInstances(comp.id)

    const instChildren = graph.getChildren(expectDefined(instance, 'instance').id)
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
    expect(expectDefined(instance, 'instance').type).toBe('INSTANCE')

    graph.detachInstance(expectDefined(instance, 'instance').id)
    expect(expectDefined(instance, 'instance').type).toBe('FRAME')
    expect(instance.componentId).toBeNull()
    expect(graph.getInstances(comp.id)).toHaveLength(0)
  })
})
