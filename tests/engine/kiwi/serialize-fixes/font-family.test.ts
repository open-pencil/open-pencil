import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile, SceneGraph } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

import { pageId, toKiwi } from './helpers'

describe('Fix 5: font family normalization in derivedTextData', () => {
  test('optical size suffix stripped in roundtrip', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'OpticalSize',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'DM Sans 9pt',
      fontWeight: 400,
      fontSize: 14
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = expectDefined(
      [...reimported.nodes.values()].find((n) => n.type === 'TEXT'),
      'text node'
    )
    expect(textNode.fontFamily).toBe('DM Sans')
  })

  test('Variable suffix stripped in roundtrip', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'Variable',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Roboto Variable',
      fontWeight: 700,
      fontSize: 14
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = expectDefined(
      [...reimported.nodes.values()].find((n) => n.type === 'TEXT'),
      'text node'
    )
    expect(textNode.fontFamily).toBe('Roboto')
  })

  test('normal font family preserved unchanged', async () => {
    const graph = new SceneGraph()
    graph.createNode('TEXT', pageId(graph), {
      name: 'Normal',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 14
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = expectDefined(
      [...reimported.nodes.values()].find((n) => n.type === 'TEXT'),
      'text node'
    )
    expect(textNode.fontFamily).toBe('Inter')
  })

  test('fontName in kiwi output uses normalized family', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'KiwiFontName',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'DM Sans 18px',
      fontWeight: 400,
      fontSize: 14
    })

    const changes = toKiwi(node, graph) as Record<string, unknown>[]
    expect(changes[0].fontName.family).toBe('DM Sans')
  })
})

// ---------------------------------------------------------------------------
// Integration: all fixes together in a realistic auto-layout component
// ---------------------------------------------------------------------------
