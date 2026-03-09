import { describe, test, expect } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function rect(
  graph: SceneGraph,
  parentId: string,
  props: { name?: string; x?: number; y?: number; width?: number; height?: number } = {}
) {
  return graph.createNode('RECTANGLE', parentId, {
    name: props.name ?? 'Rect',
    x: props.x ?? 0,
    y: props.y ?? 0,
    width: props.width ?? 50,
    height: props.height ?? 50
  })
}

describe('flip', () => {
  test('flipX defaults to false', () => {
    const graph = new SceneGraph()
    const node = rect(graph, pageId(graph))
    expect(node.flipX).toBe(false)
    expect(node.flipY).toBe(false)
  })

  test('flipX can be set via updateNode', () => {
    const graph = new SceneGraph()
    const node = rect(graph, pageId(graph))
    graph.updateNode(node.id, { flipX: true })
    expect(graph.getNode(node.id)!.flipX).toBe(true)
    expect(graph.getNode(node.id)!.flipY).toBe(false)
  })

  test('flipY can be set via updateNode', () => {
    const graph = new SceneGraph()
    const node = rect(graph, pageId(graph))
    graph.updateNode(node.id, { flipY: true })
    expect(graph.getNode(node.id)!.flipX).toBe(false)
    expect(graph.getNode(node.id)!.flipY).toBe(true)
  })

  test('flip toggles', () => {
    const graph = new SceneGraph()
    const node = rect(graph, pageId(graph))
    graph.updateNode(node.id, { flipX: true })
    expect(graph.getNode(node.id)!.flipX).toBe(true)
    graph.updateNode(node.id, { flipX: false })
    expect(graph.getNode(node.id)!.flipX).toBe(false)
  })
})

describe('single-node alignment to parent', () => {
  function setup() {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Container',
      x: 0,
      y: 0,
      width: 400,
      height: 300
    })
    const child = rect(graph, frame.id, { name: 'Child', x: 50, y: 50, width: 100, height: 80 })
    return { graph, frame, child }
  }

  test('align left within parent', () => {
    const { graph, frame, child } = setup()
    graph.updateNode(child.id, { x: 0 })
    expect(graph.getNode(child.id)!.x).toBe(0)
  })

  test('align right within parent', () => {
    const { graph, frame, child } = setup()
    const targetX = frame.width - child.width
    graph.updateNode(child.id, { x: targetX })
    expect(graph.getNode(child.id)!.x).toBe(300)
  })

  test('align center horizontal within parent', () => {
    const { graph, frame, child } = setup()
    const targetX = (frame.width - child.width) / 2
    graph.updateNode(child.id, { x: targetX })
    expect(graph.getNode(child.id)!.x).toBe(150)
  })

  test('align top within parent', () => {
    const { graph, child } = setup()
    graph.updateNode(child.id, { y: 0 })
    expect(graph.getNode(child.id)!.y).toBe(0)
  })

  test('align bottom within parent', () => {
    const { graph, frame, child } = setup()
    const targetY = frame.height - child.height
    graph.updateNode(child.id, { y: targetY })
    expect(graph.getNode(child.id)!.y).toBe(220)
  })

  test('align center vertical within parent', () => {
    const { graph, frame, child } = setup()
    const targetY = (frame.height - child.height) / 2
    graph.updateNode(child.id, { y: targetY })
    expect(graph.getNode(child.id)!.y).toBe(110)
  })
})

describe('multi-node alignment', () => {
  function setup() {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const a = rect(graph, page, { name: 'A', x: 10, y: 20, width: 50, height: 30 })
    const b = rect(graph, page, { name: 'B', x: 100, y: 80, width: 60, height: 40 })
    const c = rect(graph, page, { name: 'C', x: 200, y: 50, width: 40, height: 50 })
    return { graph, a, b, c }
  }

  test('align left — all nodes move to min x', () => {
    const { graph, a, b, c } = setup()
    const nodes = [a, b, c].map((n) => graph.getNode(n.id)!)
    const abs = nodes.map((n) => graph.getAbsolutePosition(n.id))
    const minX = Math.min(...abs.map((p, i) => p.x))

    for (const n of nodes) {
      const nodeAbs = graph.getAbsolutePosition(n.id)
      graph.updateNode(n.id, { x: n.x + (minX - nodeAbs.x) })
    }

    expect(graph.getNode(a.id)!.x).toBe(10)
    expect(graph.getNode(b.id)!.x).toBe(10)
    expect(graph.getNode(c.id)!.x).toBe(10)
  })

  test('align right — all nodes align to max right edge', () => {
    const { graph, a, b, c } = setup()
    const nodes = [a, b, c].map((n) => graph.getNode(n.id)!)
    const abs = nodes.map((n) => graph.getAbsolutePosition(n.id))
    const maxX = Math.max(...abs.map((p, i) => p.x + nodes[i].width))

    for (const n of nodes) {
      const nodeAbs = graph.getAbsolutePosition(n.id)
      const targetX = maxX - n.width
      graph.updateNode(n.id, { x: n.x + (targetX - nodeAbs.x) })
    }

    expect(graph.getNode(a.id)!.x).toBe(190)
    expect(graph.getNode(b.id)!.x).toBe(180)
    expect(graph.getNode(c.id)!.x).toBe(200)
  })

  test('align top — all nodes move to min y', () => {
    const { graph, a, b, c } = setup()
    const nodes = [a, b, c].map((n) => graph.getNode(n.id)!)
    const abs = nodes.map((n) => graph.getAbsolutePosition(n.id))
    const minY = Math.min(...abs.map((p) => p.y))

    for (const n of nodes) {
      const nodeAbs = graph.getAbsolutePosition(n.id)
      graph.updateNode(n.id, { y: n.y + (minY - nodeAbs.y) })
    }

    expect(graph.getNode(a.id)!.y).toBe(20)
    expect(graph.getNode(b.id)!.y).toBe(20)
    expect(graph.getNode(c.id)!.y).toBe(20)
  })
})

describe('multi-node property merging', () => {
  test('same values merge to single value', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const a = rect(graph, page, { width: 100, height: 50 })
    const b = rect(graph, page, { width: 100, height: 50 })
    const nodes = [graph.getNode(a.id)!, graph.getNode(b.id)!]

    const widths = new Set(nodes.map((n) => n.width))
    expect(widths.size).toBe(1)
    expect([...widths][0]).toBe(100)
  })

  test('different values are detected', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const a = rect(graph, page, { width: 100 })
    const b = rect(graph, page, { width: 200 })
    const nodes = [graph.getNode(a.id)!, graph.getNode(b.id)!]

    const widths = new Set(nodes.map((n) => n.width))
    expect(widths.size).toBe(2)
  })

  test('update applies to all selected nodes', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const a = rect(graph, page, { width: 100 })
    const b = rect(graph, page, { width: 200 })
    const c = rect(graph, page, { width: 150 })

    for (const id of [a.id, b.id, c.id]) {
      graph.updateNode(id, { width: 300 })
    }

    expect(graph.getNode(a.id)!.width).toBe(300)
    expect(graph.getNode(b.id)!.width).toBe(300)
    expect(graph.getNode(c.id)!.width).toBe(300)
  })

  test('opacity update applies uniformly', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const a = rect(graph, page)
    const b = rect(graph, page)

    graph.updateNode(a.id, { opacity: 0.5 })
    graph.updateNode(b.id, { opacity: 0.8 })

    for (const id of [a.id, b.id]) {
      graph.updateNode(id, { opacity: 0.75 })
    }

    expect(graph.getNode(a.id)!.opacity).toBe(0.75)
    expect(graph.getNode(b.id)!.opacity).toBe(0.75)
  })

  test('fills comparison detects mixed', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const a = rect(graph, page)
    const b = rect(graph, page)

    graph.updateNode(a.id, {
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    graph.updateNode(b.id, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const nodeA = graph.getNode(a.id)!
    const nodeB = graph.getNode(b.id)!
    expect(JSON.stringify(nodeA.fills)).not.toBe(JSON.stringify(nodeB.fills))
  })

  test('fills comparison detects same', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const fill = { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
    const a = rect(graph, page)
    const b = rect(graph, page)

    graph.updateNode(a.id, { fills: [{ ...fill }] })
    graph.updateNode(b.id, { fills: [{ ...fill }] })

    const nodeA = graph.getNode(a.id)!
    const nodeB = graph.getNode(b.id)!
    expect(JSON.stringify(nodeA.fills)).toBe(JSON.stringify(nodeB.fills))
  })
})

describe('flip roundtrip via kiwi', () => {
  async function roundtrip(graph: SceneGraph) {
    const { initCodec } = await import('../../packages/core/src/kiwi/codec')
    const { parseFigFile } = await import('../../packages/core/src/kiwi/fig-file')
    const { exportFigFile } = await import('../../packages/core/src/fig-export')
    await initCodec()
    const buf = await exportFigFile(graph)
    return parseFigFile(buf)
  }

  function findChild(graph: SceneGraph, name: string) {
    const pages = graph.getPages()
    const children = graph.getChildren(pages[0].id)
    return children.find((c) => c.name === name)
  }

  test('flipX preserved through export/import', async () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, page, { name: 'Flipped', x: 50, y: 50, width: 100, height: 80 })
    graph.updateNode(graph.getChildren(page).find((n) => n.name === 'Flipped')!.id, { flipX: true })

    const imported = await roundtrip(graph)
    const found = findChild(imported, 'Flipped')
    expect(found).toBeTruthy()
    expect(found!.flipX).toBe(true)
  })

  test('non-flipped node stays non-flipped', async () => {
    const graph = new SceneGraph()
    rect(graph, pageId(graph), { name: 'Normal', x: 100, y: 50, width: 200, height: 100 })

    const imported = await roundtrip(graph)
    const found = findChild(imported, 'Normal')
    expect(found).toBeTruthy()
    expect(found!.flipX).toBe(false)
  })

  test('flipX with rotation preserved', async () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    rect(graph, page, { name: 'RotFlip', x: 0, y: 0, width: 100, height: 100 })
    graph.updateNode(graph.getChildren(page).find((n) => n.name === 'RotFlip')!.id, {
      flipX: true,
      rotation: 45
    })

    const imported = await roundtrip(graph)
    const found = findChild(imported, 'RotFlip')
    expect(found).toBeTruthy()
    expect(found!.flipX).toBe(true)
    expect(Math.round(found!.rotation)).toBe(45)
  })
})
