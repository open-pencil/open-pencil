import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile, SceneGraph, sceneNodeToKiwi } from '@open-pencil/core'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'

import { ROOT_GUID, pageId } from './helpers'

describe('Integration: auto-layout component with all fixes', () => {
  test('full component roundtrip preserves layout structure', async () => {
    const graph = new SceneGraph()

    // Parent auto-layout frame (like a card component)
    const card = graph.createNode('FRAME', pageId(graph), {
      name: 'StatCard',
      x: 100,
      y: 100,
      width: 328,
      height: 200,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      paddingTop: 16,
      paddingLeft: 16,
      paddingBottom: 16,
      paddingRight: 16,
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      clipsContent: true,
      strokesIncludedInLayout: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })

    // Title text
    graph.createNode('TEXT', card.id, {
      name: 'Title',
      x: 16,
      y: 16,
      width: 296,
      height: 20,
      text: 'Total Active Users',
      fontFamily: 'DM Sans 9pt',
      fontWeight: 600,
      fontSize: 14,
      lineHeight: 20
    })

    // Value text
    graph.createNode('TEXT', card.id, {
      name: 'Value',
      x: 16,
      y: 44,
      width: 296,
      height: 40,
      text: '12,345',
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 32,
      lineHeight: 40
    })

    // Verify kiwi output directly
    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      getNodeOrThrow(graph, card.id),
      ROOT_GUID,
      0,
      { value: 100 },
      graph,
      blobs
    ) as Record<string, unknown>[]

    const cardNc = changes[0]
    const titleNc = expectDefined(
      changes.find((nc) => nc.name === 'Title'),
      'Title node change'
    )
    const valueNc = expectDefined(
      changes.find((nc) => nc.name === 'Value'),
      'Value node change'
    )

    // Fix 1: children have zero transforms
    expect(titleNc.transform.m02).toBe(0)
    expect(titleNc.transform.m12).toBe(0)
    expect(valueNc.transform.m02).toBe(0)
    expect(valueNc.transform.m12).toBe(0)

    // Fix 2: frameMaskDisabled is inverse of clipsContent
    expect(cardNc.frameMaskDisabled).toBe(false) // clipsContent=true → frameMaskDisabled=false
    expect(titleNc.frameMaskDisabled).toBe(true) // text nodes don't clip

    // Fix 3: bordersTakeSpace
    expect(cardNc.bordersTakeSpace).toBe(true)

    // Fix 4: lineHeight on text nodes
    expect(titleNc.lineHeight).toEqual({ value: 20, units: 'PIXELS' })
    expect(valueNc.lineHeight).toEqual({ value: 40, units: 'PIXELS' })

    // Fix 5: font family normalized
    expect(titleNc.fontName.family).toBe('DM Sans')
    expect(valueNc.fontName.family).toBe('Inter')

    // Roundtrip through export/parse
    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const nodes = [...reimported.nodes.values()]
    const cardNode = expectDefined(
      nodes.find((n) => n.name === 'StatCard'),
      'StatCard node'
    )
    const titleNode = expectDefined(
      nodes.find((n) => n.name === 'Title'),
      'Title node'
    )

    expect(cardNode.layoutMode).toBe('VERTICAL')
    expect(cardNode.clipsContent).toBe(true)
    expect(titleNode.fontFamily).toBe('DM Sans')
    expect(titleNode.lineHeight).toBe(20)
  })
})
