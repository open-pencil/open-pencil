import { describe, expect, test } from 'bun:test'

import {
  applyGeneratedFreeformStretch,
  buildDsdLayoutUpdates,
  propagateDsdChanges,
  type OverrideContext
} from '@open-pencil/fig/instance-overrides'
import { getNodeLocalMatrix, SceneGraph } from '@open-pencil/scene-graph'

function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

describe('fig import derived symbol data', () => {
  test('propagates derived glyphs through clone chains', () => {
    const graph = new SceneGraph()
    const source = graph.createNode('TEXT', pageId(graph), {
      text: 'Account',
      derivedTextGlyphs: [{ commandsBlob: new Uint8Array([0]), x: 0, y: 10, fontSize: 14 }],
      derivedLayout: { width: 56, height: 20 }
    })
    const clone = graph.createNode('TEXT', pageId(graph), {
      text: 'Account',
      componentId: source.id
    })
    const ctx = {
      graph,
      activeNodeIds: new Set([source.id, clone.id]),
      geometryOverrideNodes: new Set()
    } as OverrideContext

    propagateDsdChanges(ctx, new Set([source.id]), new Set())

    expect(clone.derivedTextGlyphs).toEqual(source.derivedTextGlyphs)
    expect(clone.derivedLayout).toEqual(source.derivedLayout)
  })

  test('inherits derived positions when a clone has an explicit derived size', () => {
    const graph = new SceneGraph()
    const source = graph.createNode('INSTANCE', pageId(graph), {
      x: 152,
      y: 0,
      width: 136,
      height: 40,
      derivedLayout: { x: 152, y: 0, width: 136, height: 40 }
    })
    const clone = graph.createNode('INSTANCE', pageId(graph), {
      x: 136,
      y: 0,
      width: 144,
      height: 48,
      componentId: source.id,
      derivedLayout: { x: 136, y: 4, width: 144, height: 48 }
    })
    const ctx = {
      graph,
      activeNodeIds: new Set([source.id, clone.id]),
      geometryOverrideNodes: new Set()
    } as OverrideContext

    propagateDsdChanges(ctx, new Set([source.id]), new Set([clone.id]))

    expect(graph.getNode(clone.id)).toMatchObject({
      x: 152,
      y: 0,
      derivedLayout: {
        x: 152,
        y: 0,
        width: 144,
        height: 48
      }
    })
  })

  test('applies generated stretch dimensions inside authoritative freeform parents', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      width: 232,
      height: 24,
      layoutMode: 'NONE',
      derivedLayout: { width: 232, height: 24 }
    })
    const text = graph.createNode('TEXT', parent.id, {
      width: 256,
      height: 20,
      horizontalConstraint: 'STRETCH',
      derivedLayout: { width: 232, height: 20 }
    })
    const ctx = {
      graph,
      activeNodeIds: new Set([parent.id, text.id])
    } as OverrideContext

    applyGeneratedFreeformStretch(ctx)

    expect(graph.getNode(text.id)?.width).toBe(232)
  })

  test('ignores stretch axes without derived dimensions', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      width: 232,
      height: 24,
      layoutMode: 'NONE',
      derivedLayout: { width: 232 }
    })
    const child = graph.createNode('FRAME', parent.id, {
      width: 100,
      height: 20,
      horizontalConstraint: 'STRETCH',
      verticalConstraint: 'STRETCH',
      derivedLayout: { height: 20 }
    })
    const ctx = { graph, activeNodeIds: new Set([parent.id, child.id]) } as OverrideContext

    applyGeneratedFreeformStretch(ctx)

    expect(graph.getNode(child.id)).toMatchObject({ width: 100, height: 20 })
  })

  test('keeps the existing position when derived data only changes size', () => {
    const graph = new SceneGraph()
    const component = graph.createNode('COMPONENT', pageId(graph), { x: 100, y: 100 })
    const target = graph.createNode('INSTANCE', pageId(graph), {
      x: 8,
      y: 8,
      componentId: component.id
    })
    const ctx = { graph, blobs: [] } as OverrideContext

    const { updates } = buildDsdLayoutUpdates(ctx, new Map(), { size: { x: 184, y: 36 } }, target)

    expect(updates).toMatchObject({ width: 184, height: 36 })
    expect(updates.x).toBeUndefined()
    expect(updates.y).toBeUndefined()
  })

  test('preserves a reflected rotated transform when derived data only changes size', () => {
    const graph = new SceneGraph()
    const target = graph.createNode('VECTOR', pageId(graph), {
      x: 13.5,
      y: 30.5,
      width: 73,
      height: 68,
      rotation: 90,
      flipX: true
    })
    const ctx = { graph, blobs: [] } as OverrideContext
    const before = getNodeLocalMatrix(target)

    const { updates } = buildDsdLayoutUpdates(ctx, new Map(), { size: { x: 762, y: 50 } }, target)
    const after = getNodeLocalMatrix({ ...target, ...updates })

    expect(updates).toMatchObject({ width: 762, height: 50, x: -340, y: 384 })
    for (let i = 0; i < before.length; i++) expect(after[i]).toBeCloseTo(before[i], 10)
  })

  test('decomposes a complete reflected transform override around the node center', () => {
    const graph = new SceneGraph()
    const target = graph.createNode('INSTANCE', pageId(graph), {
      width: 24,
      height: 24
    })
    const ctx = { graph, blobs: [] } as OverrideContext
    const transform = {
      m00: 0,
      m01: -1,
      m02: 78,
      m10: -1,
      m11: 0,
      m12: 790
    }

    const { updates } = buildDsdLayoutUpdates(ctx, new Map(), { transform }, target)
    const matrix = getNodeLocalMatrix({ ...target, ...updates })

    expect(updates).toMatchObject({ x: 54, y: 766, rotation: -90, flipX: true, flipY: false })
    const expected = [0, -1, 78, -1, 0, 790]
    for (let i = 0; i < expected.length; i++) expect(matrix[i]).toBeCloseTo(expected[i], 10)
  })

  test('routes derived text glyphs through layout patch updates', () => {
    const graph = new SceneGraph()
    const target = graph.createNode('TEXT', pageId(graph), { text: 'Menu Item' })
    const glyphBlob = new Uint8Array([0])
    const ctx = {
      graph,
      blobs: [glyphBlob]
    } as OverrideContext

    const { updates } = buildDsdLayoutUpdates(
      ctx,
      new Map(),
      {
        derivedTextData: {
          layoutSize: { x: 64, y: 20 },
          glyphs: [
            {
              commandsBlob: 0,
              position: { x: 4, y: 15 },
              fontSize: 14,
              firstCharacter: 0,
              advance: 1,
              rotation: 0
            }
          ]
        }
      },
      target
    )

    expect(updates.derivedTextGlyphs).toEqual([
      {
        commandsBlob: glyphBlob,
        x: 4,
        y: 15,
        fontSize: 14,
        // Path text needs per-glyph rotation preserved through import (#396);
        // plain text imports it as 0 rather than dropping the field.
        rotation: 0
      }
    ])
  })
})
