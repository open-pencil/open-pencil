import { describe, test, expect } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('hitTest — group behavior', () => {
  function setup() {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const group = graph.createNode('GROUP', page, {
      name: 'Group',
      x: 100,
      y: 100,
      width: 200,
      height: 200
    })
    const child = graph.createNode('RECTANGLE', group.id, {
      name: 'Rect',
      x: 10,
      y: 10,
      width: 50,
      height: 50
    })
    return { graph, page, group, child }
  }

  test('single click on child returns GROUP (not child)', () => {
    const { graph, page, child } = setup()
    const hit = graph.hitTest(110, 110, page)
    expect(hit).not.toBeNull()
    expect(hit!.type).toBe('GROUP')
  })

  test('hitTestDeep on child returns child directly', () => {
    const { graph, page, child } = setup()
    const hit = graph.hitTestDeep(110, 110, page)
    expect(hit).not.toBeNull()
    expect(hit!.id).toBe(child.id)
  })

  test('hitTest with scope=group returns child', () => {
    const { graph, group } = setup()
    const hit = graph.hitTest(10, 10, group.id)
    expect(hit).not.toBeNull()
    expect(hit!.name).toBe('Rect')
  })

  test('hitTest miss inside group returns null', () => {
    const { graph, group } = setup()
    const hit = graph.hitTest(180, 180, group.id)
    expect(hit).toBeNull()
  })

  test('click outside group returns null', () => {
    const { graph, page } = setup()
    const hit = graph.hitTest(50, 50, page)
    expect(hit).toBeNull()
  })
})

describe('hitTest — nested groups', () => {
  function setup() {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const groupA = graph.createNode('GROUP', page, {
      name: 'GroupA',
      x: 100,
      y: 100,
      width: 300,
      height: 300
    })
    const groupB = graph.createNode('GROUP', groupA.id, {
      name: 'GroupB',
      x: 50,
      y: 50,
      width: 100,
      height: 100
    })
    const rect = graph.createNode('RECTANGLE', groupB.id, {
      name: 'DeepRect',
      x: 10,
      y: 10,
      width: 30,
      height: 30
    })
    return { graph, page, groupA, groupB, rect }
  }

  test('click from page scope returns GroupA', () => {
    const { graph, page } = setup()
    const hit = graph.hitTest(160, 160, page)
    expect(hit).not.toBeNull()
    expect(hit!.name).toBe('GroupA')
  })

  test('click with scope=GroupA returns GroupB', () => {
    const { graph, groupA } = setup()
    const hit = graph.hitTest(60, 60, groupA.id)
    expect(hit).not.toBeNull()
    expect(hit!.name).toBe('GroupB')
  })

  test('click with scope=GroupB returns DeepRect', () => {
    const { graph, groupB } = setup()
    const hit = graph.hitTest(10, 10, groupB.id)
    expect(hit).not.toBeNull()
    expect(hit!.name).toBe('DeepRect')
  })

  test('hitTestDeep from page returns deepest child', () => {
    const { graph, page, rect } = setup()
    const hit = graph.hitTestDeep(160, 160, page)
    expect(hit).not.toBeNull()
    expect(hit!.id).toBe(rect.id)
  })
})

describe('hitTest — locked nodes', () => {
  test('locked container blocks enter (returns container, not child)', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page, {
      name: 'LockedFrame',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      locked: true
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Child',
      x: 10,
      y: 10,
      width: 50,
      height: 50
    })

    const hit = graph.hitTestDeep(10, 10, page)
    expect(hit).not.toBeNull()
    expect(hit!.name).toBe('LockedFrame')
  })

  test('locked leaf node is still clickable', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    graph.createNode('RECTANGLE', page, {
      name: 'LockedRect',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      locked: true
    })

    const hit = graph.hitTest(25, 25, page)
    expect(hit).not.toBeNull()
    expect(hit!.name).toBe('LockedRect')
  })
})

describe('hitTest — visibility', () => {
  test('invisible node is not hit', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    graph.createNode('RECTANGLE', page, {
      name: 'Hidden',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      visible: false
    })

    const hit = graph.hitTest(25, 25, page)
    expect(hit).toBeNull()
  })
})

describe('scene graph — locked node operations', () => {
  test('locked node cannot be deleted via filter', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rect = graph.createNode('RECTANGLE', page, {
      name: 'LockedRect',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      locked: true
    })

    const node = graph.getNode(rect.id)
    expect(node).not.toBeNull()
    expect(node!.locked).toBe(true)
  })

  test('lock can be toggled', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rect = graph.createNode('RECTANGLE', page, {
      name: 'Rect',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })

    expect(graph.getNode(rect.id)!.locked).toBe(false)
    graph.updateNode(rect.id, { locked: true })
    expect(graph.getNode(rect.id)!.locked).toBe(true)
    graph.updateNode(rect.id, { locked: false })
    expect(graph.getNode(rect.id)!.locked).toBe(false)
  })

  test('visibility can be toggled', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rect = graph.createNode('RECTANGLE', page, {
      name: 'Rect',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })

    expect(graph.getNode(rect.id)!.visible).toBe(true)
    graph.updateNode(rect.id, { visible: false })
    expect(graph.getNode(rect.id)!.visible).toBe(false)
    graph.updateNode(rect.id, { visible: true })
    expect(graph.getNode(rect.id)!.visible).toBe(true)
  })
})

describe('hitTest — frame with children', () => {
  test('frame scope hit test finds children', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page, {
      name: 'Frame',
      x: 50,
      y: 50,
      width: 200,
      height: 200
    })
    const child = graph.createNode('RECTANGLE', frame.id, {
      name: 'InnerRect',
      x: 20,
      y: 20,
      width: 40,
      height: 40
    })

    const hit = graph.hitTest(20, 20, frame.id)
    expect(hit).not.toBeNull()
    expect(hit!.id).toBe(child.id)
  })

  test('rotated frame scope hit test finds children using rotated local bounds', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page, {
      name: 'RotatedFrame',
      x: 100,
      y: 100,
      width: 200,
      height: 120,
      rotation: 45
    })
    const child = graph.createNode('RECTANGLE', frame.id, {
      name: 'InnerRect',
      x: 60,
      y: 30,
      width: 80,
      height: 40
    })

    const hitInside = graph.hitTest(100, 60, frame.id)
    expect(hitInside).not.toBeNull()
    expect(hitInside!.id).toBe(child.id)

    const hitOutside = graph.hitTest(10, 10, frame.id)
    expect(hitOutside).toBeNull()
  })
})

describe('hitTest — opaque containers (COMPONENT/INSTANCE)', () => {
  test('hitTest on COMPONENT returns component itself (not child)', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const comp = graph.createNode('COMPONENT', page, {
      name: 'MyComp',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    graph.createNode('RECTANGLE', comp.id, {
      name: 'CompChild',
      x: 10,
      y: 10,
      width: 30,
      height: 30
    })

    const hit = graph.hitTest(10, 10, page)
    expect(hit).not.toBeNull()
    expect(hit!.name).toBe('MyComp')
  })

  test('hitTestDeep inside COMPONENT scope finds child', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const comp = graph.createNode('COMPONENT', page, {
      name: 'MyComp',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    const child = graph.createNode('RECTANGLE', comp.id, {
      name: 'CompChild',
      x: 10,
      y: 10,
      width: 30,
      height: 30
    })

    const hit = graph.hitTestDeep(10, 10, comp.id)
    expect(hit).not.toBeNull()
    expect(hit!.id).toBe(child.id)
  })

  test('hitTest on INSTANCE returns instance itself', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const inst = graph.createNode('INSTANCE', page, {
      name: 'MyInstance',
      x: 50,
      y: 50,
      width: 80,
      height: 80
    })
    graph.createNode('RECTANGLE', inst.id, {
      name: 'InstChild',
      x: 5,
      y: 5,
      width: 20,
      height: 20
    })

    const hit = graph.hitTest(55, 55, page)
    expect(hit).not.toBeNull()
    expect(hit!.name).toBe('MyInstance')
  })

  test('hitTestDeep inside INSTANCE scope finds child', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const inst = graph.createNode('INSTANCE', page, {
      name: 'MyInstance',
      x: 50,
      y: 50,
      width: 80,
      height: 80
    })
    const child = graph.createNode('RECTANGLE', inst.id, {
      name: 'InstChild',
      x: 5,
      y: 5,
      width: 20,
      height: 20
    })

    const hit = graph.hitTestDeep(5, 5, inst.id)
    expect(hit).not.toBeNull()
    expect(hit!.id).toBe(child.id)
  })
})

describe('hitTest — absolute position and scope offset', () => {
  test('scoped hitTest accounts for parent offset', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page, {
      name: 'Frame',
      x: 200,
      y: 300,
      width: 400,
      height: 400
    })
    const child = graph.createNode('RECTANGLE', frame.id, {
      name: 'Child',
      x: 50,
      y: 60,
      width: 100,
      height: 100
    })

    const abs = graph.getAbsolutePosition(frame.id)
    expect(abs.x).toBe(200)
    expect(abs.y).toBe(300)

    const hit = graph.hitTest(50, 60, frame.id)
    expect(hit).not.toBeNull()
    expect(hit!.id).toBe(child.id)

    const missHit = graph.hitTest(250, 360, frame.id)
    expect(missHit).toBeNull()
  })
})
