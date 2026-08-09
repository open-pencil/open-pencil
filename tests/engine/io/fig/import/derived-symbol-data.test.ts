import { describe, expect, test } from 'bun:test'

import {
  applyGeneratedFreeformStretch,
  buildDsdLayoutUpdates,
  propagateDsdChanges,
  type OverrideContext
} from '@open-pencil/fig/instance-overrides'
import { SceneGraph } from '@open-pencil/scene-graph'

function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

describe('fig import derived symbol data', () => {
  test('propagates derived glyphs through clone chains', () => {
    const graph = new SceneGraph()
    const source = graph.createNode('TEXT', pageId(graph), {
      text: 'Account',
      figmaDerivedTextGlyphs: [{ commandsBlob: new Uint8Array([0]), x: 0, y: 10, fontSize: 14 }],
      figmaDerivedLayout: { width: 56, height: 20 }
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

    expect(clone.figmaDerivedTextGlyphs).toEqual(source.figmaDerivedTextGlyphs)
    expect(clone.figmaDerivedLayout).toEqual(source.figmaDerivedLayout)
  })

  test('inherits derived positions when a clone has an explicit derived size', () => {
    const graph = new SceneGraph()
    const source = graph.createNode('INSTANCE', pageId(graph), {
      x: 152,
      y: 0,
      width: 136,
      height: 40,
      figmaDerivedLayout: { x: 152, y: 0, width: 136, height: 40 }
    })
    const clone = graph.createNode('INSTANCE', pageId(graph), {
      x: 136,
      y: 0,
      width: 144,
      height: 48,
      componentId: source.id,
      figmaDerivedLayout: { x: 136, y: 4, width: 144, height: 48 }
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
      figmaDerivedLayout: {
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
      figmaDerivedLayout: { width: 232, height: 24 }
    })
    const text = graph.createNode('TEXT', parent.id, {
      width: 256,
      height: 20,
      horizontalConstraint: 'STRETCH',
      figmaDerivedLayout: { width: 232, height: 20 }
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
      figmaDerivedLayout: { width: 232 }
    })
    const child = graph.createNode('FRAME', parent.id, {
      width: 100,
      height: 20,
      horizontalConstraint: 'STRETCH',
      verticalConstraint: 'STRETCH',
      figmaDerivedLayout: { height: 20 }
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

    expect(updates.figmaDerivedTextGlyphs).toEqual([
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
