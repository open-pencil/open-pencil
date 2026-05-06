import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile, SceneGraph } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

import { pageId, toKiwi } from '../helpers'

describe('Fix 2: frameMaskDisabled is inverse of clipsContent', () => {
  test('FRAME without clipsContent gets frameMaskDisabled=true', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'Frame',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })

    const changes = toKiwi(node, graph) as Record<string, unknown>[]
    expect(changes[0].frameMaskDisabled).toBe(true)
  })

  test('FRAME with clipsContent=true gets frameMaskDisabled=false', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'Clipping',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      clipsContent: true
    })

    const changes = toKiwi(node, graph) as Record<string, unknown>[]
    expect(changes[0].frameMaskDisabled).toBe(false)
  })

  test('FRAME with clipsContent=false gets frameMaskDisabled=true', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'NoClip',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      clipsContent: false
    })

    const changes = toKiwi(node, graph) as Record<string, unknown>[]
    expect(changes[0].frameMaskDisabled).toBe(true)
  })

  test('clipsContent roundtrips through export/parse', async () => {
    const graph = new SceneGraph()
    graph.createNode('FRAME', pageId(graph), {
      name: 'ClipFrame',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      clipsContent: true
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const frame = expectDefined(
      [...reimported.nodes.values()].find((n) => n.name === 'ClipFrame'),
      'ClipFrame'
    )
    expect(frame.clipsContent).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Fix 3 — bordersTakeSpace writes strokesIncludedInLayout
// ---------------------------------------------------------------------------
