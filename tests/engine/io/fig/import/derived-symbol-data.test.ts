import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import type { OverrideContext } from '#core/kiwi/fig/instance-overrides'
import { buildDsdLayoutUpdates } from '#core/kiwi/fig/instance-overrides/derived-symbol-data/layout'
import { propagateDsdChanges } from '#core/kiwi/fig/instance-overrides/derived-symbol-data/propagate'

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
        fontSize: 14
      }
    ])
  })
})
