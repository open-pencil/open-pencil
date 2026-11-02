import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'
import { lineHeightPixels, pixelLength } from '@open-pencil/scene-graph/text'

import { expectDefined } from '#tests/helpers/assert'

import { pageId, toKiwi } from '../helpers'

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
      lineHeight: pixelLength(24)
    })

    const changes = toKiwi(node, graph)
    expect(changes[0].lineHeight).toEqual({ value: 24, units: 'PIXELS' })
  })

  test('text node in auto line height writes it as Figma does', () => {
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
    })

    const changes = toKiwi(node, graph)
    expect(changes[0].lineHeight).toEqual({ value: 100, units: 'PERCENT' })
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
      lineHeight: pixelLength(28)
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = expectDefined(
      [...reimported.nodes.values()].find((n) => n.type === 'TEXT'),
      'text node'
    )
    expect(lineHeightPixels(textNode.lineHeight, textNode.fontSize)).toBe(28)
  })
})

// ---------------------------------------------------------------------------
// Fix 5 — Font family normalization in derivedTextData
// ---------------------------------------------------------------------------
