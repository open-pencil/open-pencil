import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile, SceneGraph } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

import { pageId, toKiwi } from './helpers'

describe('Fix 4: text lineHeight serialization', () => {
  test('text node with explicit lineHeight uses that value', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'ExplicitLH',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16,
      lineHeight: 24
    })

    const changes = toKiwi(node, graph) as Record<string, unknown>[]
    expect(changes[0].lineHeight).toEqual({ value: 24, units: 'PIXELS' })
  })

  test('text node without lineHeight defaults to ceil(fontSize * 1.2)', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'DefaultLH',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16
      // lineHeight not set — defaults to null
    })

    const changes = toKiwi(node, graph) as Record<string, unknown>[]
    // ceil(16 * 1.2) = ceil(19.2) = 20
    expect(changes[0].lineHeight).toEqual({ value: 20, units: 'PIXELS' })
  })

  test('lineHeight default for odd fontSize', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'OddSize',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 14
    })

    const changes = toKiwi(node, graph) as Record<string, unknown>[]
    // ceil(14 * 1.2) = ceil(16.8) = 17
    expect(changes[0].lineHeight).toEqual({ value: 17, units: 'PIXELS' })
  })

  test('lineHeight survives roundtrip through export/parse', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'Roundtrip',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16,
      lineHeight: 28
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = expectDefined(
      [...reimported.nodes.values()].find((n) => n.type === 'TEXT'),
      'text node'
    )
    expect(textNode.lineHeight).toBe(28)
  })
})

// ---------------------------------------------------------------------------
// Fix 5 — Font family normalization in derivedTextData
// ---------------------------------------------------------------------------
