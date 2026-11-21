import { describe, expect, test } from 'bun:test'

import { compactDesign } from '#design-json/compact/index'

import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function solid(r: number, g: number, b: number): Fill {
  return { type: 'SOLID', color: { r, g, b, a: 1 }, opacity: 1, visible: true }
}

function image(hash: string): Fill {
  return {
    type: 'IMAGE',
    color: { r: 1, g: 1, b: 1, a: 1 },
    imageHash: hash,
    opacity: 1,
    visible: true
  }
}

function page() {
  const graph = new SceneGraph()
  return { graph, pageId: graph.getPages()[0].id }
}

describe('compact design', () => {
  test('keeps what rendering needs, with boxes relative to the parent', () => {
    const { graph, pageId } = page()
    graph.images.set('photo', PNG)
    const card = graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 100,
      y: 50,
      width: 300,
      height: 200,
      fills: [solid(1, 1, 1)],
      cornerRadius: 12,
      layoutMode: 'VERTICAL',
      itemSpacing: 8
    })
    graph.createNode('TEXT', card.id, {
      name: 'Title',
      x: 16,
      y: 16,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 700,
      fills: [solid(0, 0, 0)]
    })
    graph.createNode('RECTANGLE', card.id, { name: 'Photo', x: 16, y: 60, fills: [image('photo')] })
    graph.createNode('RECTANGLE', card.id, { name: 'Hidden', visible: false })

    const { roots, images, summary } = compactDesign(graph, [card.id])
    const [root] = roots
    expect(root).toMatchObject({
      name: 'Card',
      kind: 'frame',
      box: { x: 100, y: 50, width: 300, height: 200 },
      layout: { direction: 'column', gap: 8 },
      style: { fills: [{ value: '#FFFFFF' }], radius: 12 }
    })
    expect(root.children?.map((child) => child.kind)).toEqual(['text', 'image'])
    expect(root.children?.[0]).toMatchObject({
      box: { x: 16, y: 16 },
      text: {
        content: 'Hello',
        font: { family: 'Inter', weight: 700 },
        color: { value: '#000000' }
      }
    })
    const photo = root.children?.[1]
    expect(photo?.images).toEqual(['photo'])
    expect(images.photo).toEqual({
      mimeType: 'image/png',
      byteLength: 8,
      usedBy: [photo?.id ?? '']
    })
    expect(summary).toMatchObject({
      layers: 3,
      depth: 2,
      byKind: { frame: 1, text: 1, image: 1 },
      fonts: ['Inter 700'],
      colors: ['#FFFFFF', '#000000'],
      inferred: 0
    })
  })

  test('names the main component an instance shows, and counts its instances', () => {
    const { graph, pageId } = page()
    const button = graph.createNode('COMPONENT', pageId, { name: 'Button' })
    const first = graph.createInstance(button.id, pageId)
    const second = graph.createInstance(button.id, pageId)
    if (!first || !second) throw new Error('Expected instances')
    const { roots, summary } = compactDesign(graph, [first.id, second.id])
    expect(roots[0].component).toMatchObject({ id: button.id, name: 'Button' })
    expect(summary.components).toEqual({ [button.id]: { name: 'Button', instances: 2 } })
  })

  test('with inferNesting, nests a layer drawn inside one below it and groups overlaps', () => {
    const { graph, pageId } = page()
    const board = graph.createNode('FRAME', pageId, { name: 'Board', width: 1000, height: 1000 })
    const panel = graph.createNode('RECTANGLE', board.id, {
      name: 'Panel',
      width: 400,
      height: 400
    })
    graph.createNode('RECTANGLE', board.id, { name: 'Badge', x: 10, y: 10, width: 50, height: 50 })
    graph.createNode('RECTANGLE', board.id, { name: 'A', x: 500, y: 500, width: 100, height: 100 })
    graph.createNode('RECTANGLE', board.id, { name: 'B', x: 550, y: 550, width: 100, height: 100 })

    const plain = compactDesign(graph, [board.id]).roots[0]
    expect(plain.children?.map((child) => child.name)).toEqual(['Panel', 'Badge', 'A', 'B'])

    const { roots, summary } = compactDesign(graph, [board.id], { inferNesting: true })
    const [panelNode, group] = roots[0].children ?? []
    expect(panelNode).toMatchObject({ id: panel.id, name: 'Panel' })
    expect(panelNode.children?.[0]).toMatchObject({
      name: 'Badge',
      inferred: 'contained',
      box: { x: 10, y: 10 }
    })
    expect(group).toMatchObject({
      kind: 'group',
      inferred: 'overlap',
      box: { x: 500, y: 500, width: 150, height: 150 }
    })
    expect(group.children?.map((child) => [child.name, child.box.x])).toEqual([
      ['A', 0],
      ['B', 50]
    ])
    expect(summary.inferred).toBe(2)
  })

  test('leaves a layer drawn behind another, and auto layout children, where they are', () => {
    const { graph, pageId } = page()
    const board = graph.createNode('FRAME', pageId, { name: 'Board', width: 500, height: 500 })
    graph.createNode('RECTANGLE', board.id, { name: 'Small', x: 10, y: 10, width: 20, height: 20 })
    graph.createNode('RECTANGLE', board.id, { name: 'Big', width: 100, height: 100 })
    const row = graph.createNode('FRAME', pageId, {
      name: 'Row',
      x: 1000,
      layoutMode: 'HORIZONTAL'
    })
    graph.createNode('RECTANGLE', row.id, { name: 'One', width: 50, height: 50 })
    graph.createNode('RECTANGLE', row.id, { name: 'Two', width: 50, height: 50 })

    const { roots } = compactDesign(graph, [board.id, row.id], { inferNesting: true })
    // Small is below Big, hidden behind it: an overlap, not a child.
    expect(roots[0].children?.[0]).toMatchObject({ inferred: 'overlap' })
    expect(roots[0].children?.[0].children?.map((child) => child.name)).toEqual(['Small', 'Big'])
    expect(roots[1].children?.map((child) => child.name)).toEqual(['One', 'Two'])
  })
})
