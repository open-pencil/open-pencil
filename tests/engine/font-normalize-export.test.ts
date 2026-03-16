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
