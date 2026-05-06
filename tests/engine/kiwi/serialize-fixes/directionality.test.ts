import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile, SceneGraph } from '@open-pencil/core'

import { pageId } from './helpers'

describe('Directionality plugin fallback', () => {
  test('text and layout direction roundtrip through export/parse', async () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'RTL Row',
      layoutMode: 'HORIZONTAL',
      layoutDirection: 'RTL',
      width: 240,
      height: 80
    })
    graph.createNode('TEXT', frame.id, {
      text: 'مرحبا',
      textDirection: 'RTL',
      width: 120,
      height: 24
    })

    const bytes = await exportFigFile(graph)
    const parsed = await parseFigFile(bytes.buffer as ArrayBuffer)

    const parsedFrame = [...parsed.getAllNodes()].find((node) => node.name === 'RTL Row')
    const parsedText = [...parsed.getAllNodes()].find((node) => node.type === 'TEXT')
    expect(parsedFrame?.layoutDirection).toBe('RTL')
    expect(parsedText?.textDirection).toBe('RTL')
  })
})
