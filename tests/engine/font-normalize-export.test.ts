import { describe, test, expect, beforeAll } from 'bun:test'

import {
  exportFigFile,
  parseFigFile,
  initCodec,
  SceneGraph,
} from '@open-pencil/core'

beforeAll(async () => {
  await initCodec()
})

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('Font family normalization on .fig export', () => {
  test('strips optical size suffix from font family', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'Test',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'DM Sans 9pt',
      fontWeight: 400,
      fontSize: 14,
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const nodes = [...reimported.nodes.values()]
    const textNode = nodes.find((n) => n.type === 'TEXT')!
    expect(textNode.fontFamily).toBe('DM Sans')
  })

  test('preserves normal font family names', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'Test',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 14,
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const nodes = [...reimported.nodes.values()]
    const textNode = nodes.find((n) => n.type === 'TEXT')!
    expect(textNode.fontFamily).toBe('Inter')
  })

  test('strips Variable suffix from font family', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'Test',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Roboto Variable',
      fontWeight: 400,
      fontSize: 14,
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const nodes = [...reimported.nodes.values()]
    const textNode = nodes.find((n) => n.type === 'TEXT')!
    expect(textNode.fontFamily).toBe('Roboto')
  })
})

describe('TEXT node default fill', () => {
  test('TEXT node without explicit fills exports with solid black fill', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'No Fill Specified',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 14,
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const nodes = [...reimported.nodes.values()]
    const textNode = nodes.find((n) => n.type === 'TEXT')!
    expect(textNode.fills.length).toBe(1)
    expect(textNode.fills[0].type).toBe('SOLID')
    expect(textNode.fills[0].color.r).toBe(0)
    expect(textNode.fills[0].color.g).toBe(0)
    expect(textNode.fills[0].color.b).toBe(0)
    expect(textNode.fills[0].color.a).toBe(1)
  })

  test('TEXT node with explicit fill preserves it', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'Gold Text',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 14,
      fills: [{ type: 'SOLID', color: { r: 0.96, g: 0.72, b: 0, a: 1 }, opacity: 1, visible: true }],
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const nodes = [...reimported.nodes.values()]
    const textNode = nodes.find((n) => n.type === 'TEXT')!
    expect(textNode.fills.length).toBe(1)
    expect(textNode.fills[0].color.r).toBeCloseTo(0.96, 1)
    expect(textNode.fills[0].color.g).toBeCloseTo(0.72, 1)
    expect(textNode.fills[0].color.b).toBeCloseTo(0, 1)
  })

  test('non-TEXT node still defaults to empty fills', async () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    })
    expect(graph.getNode(node.id)!.fills.length).toBe(0)
  })
})
