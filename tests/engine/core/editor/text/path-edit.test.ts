import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { pathTextEditChanges } from '#core/editor/text/path-edit'
import { fontManager } from '#core/text/fonts'
import { encodeVectorNetworkBlob } from '#core/vector'

import { expectDefined } from '#tests/helpers/assert'

/** Straight horizontal line, in 400x100 normalized space (zero tangents = no curve). */
function straightLineNetwork() {
  return {
    vertices: [
      { x: 0, y: 50 },
      { x: 400, y: 50 }
    ],
    segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
    regions: []
  }
}

describe('pathTextEditChanges — reflow on character edit', () => {
  test('re-lays out glyphs along the path instead of clearing them', async () => {
    const font = await fontManager.fetchBundledFont('/Inter-Regular.ttf')
    expect(font).toBeTruthy()
    if (!font) return
    fontManager.markLoaded('Inter', 'Regular', font)

    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const box = { x: 0, y: 0, width: 400, height: 100 }
    const node = graph.createNode('TEXT', page.id, {
      x: 0,
      y: 0,
      width: 400,
      height: 100,
      text: 'AB',
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      fontSize: 40,
      textPathBox: { ...box },
      figmaDerivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 50, y: 50, fontSize: 40, rotation: 0 },
        { commandsBlob: new Uint8Array(4), x: 90, y: 50, fontSize: 40, rotation: 0 }
      ]
    })
    node.source.fig.kiwiNodeType = 'TEXT_PATH'
    node.source.fig.rawNodeFields = {
      vectorData: {
        vectorNetworkBlob: encodeVectorNetworkBlob(straightLineNetwork()),
        normalizedSize: { x: 400, y: 100 }
      },
      textPathStart: { tValue: 0, forward: true }
    }

    const changes = pathTextEditChanges(node, { text: 'Edited' })

    const glyphs = expectDefined(changes.figmaDerivedTextGlyphs, 'reflowed glyphs')
    expect(glyphs.length).toBe('Edited'.length)
    expect(changes.strokeGeometry).toEqual([])
    // Glyphs walk forward along the path — not stacked at one point.
    expect(glyphs[glyphs.length - 1].x).toBeGreaterThan(glyphs[0].x)
    for (const g of glyphs) {
      expect(g.commandsBlob.length).toBeGreaterThan(0)
      expect(Number.isFinite(g.x)).toBe(true)
      expect(Number.isFinite(g.y)).toBe(true)
    }
  })

  test('folds letterSpacing into the pen-walk advance', async () => {
    const font = await fontManager.fetchBundledFont('/Inter-Regular.ttf')
    expect(font).toBeTruthy()
    if (!font) return
    fontManager.markLoaded('Inter', 'Regular', font)

    function lastGlyphX(letterSpacing: number): number {
      const graph = new SceneGraph()
      const page = expectDefined(graph.getPages()[0])
      const box = { x: 0, y: 0, width: 400, height: 100 }
      const node = graph.createNode('TEXT', page.id, {
        x: 0,
        y: 0,
        width: 400,
        height: 100,
        text: 'AB',
        fontFamily: 'Inter',
        fontWeight: 400,
        italic: false,
        fontSize: 40,
        letterSpacing,
        textPathBox: { ...box },
        figmaDerivedTextGlyphs: [
          { commandsBlob: new Uint8Array(4), x: 50, y: 50, fontSize: 40, rotation: 0 },
          { commandsBlob: new Uint8Array(4), x: 90, y: 50, fontSize: 40, rotation: 0 }
        ]
      })
      node.source.fig.kiwiNodeType = 'TEXT_PATH'
      node.source.fig.rawNodeFields = {
        vectorData: {
          vectorNetworkBlob: encodeVectorNetworkBlob(straightLineNetwork()),
          normalizedSize: { x: 400, y: 100 }
        },
        textPathStart: { tValue: 0, forward: true }
      }
      const changes = pathTextEditChanges(node, { text: 'ABCD' })
      const glyphs = expectDefined(changes.figmaDerivedTextGlyphs, 'reflowed glyphs')
      return glyphs[glyphs.length - 1].x
    }

    // Wider tracking pushes the last glyph further along the (straight) path.
    expect(lastGlyphX(20)).toBeGreaterThan(lastGlyphX(0))
  })

  test('falls back to {} when the node has no path data', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const node = graph.createNode('TEXT', page.id, {
      text: 'AB',
      figmaDerivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 0, y: 0, fontSize: 40, rotation: 0 }
      ]
    })
    node.source.fig.kiwiNodeType = 'TEXT_PATH'
    // No textPathBox / rawNodeFields.vectorData — not reflowable.
    expect(pathTextEditChanges(node, { text: 'Edited' })).toEqual({})
  })

  test('uses pending fontSize from the same update batch', async () => {
    const font = await fontManager.fetchBundledFont('/Inter-Regular.ttf')
    expect(font).toBeTruthy()
    if (!font) return
    fontManager.markLoaded('Inter', 'Regular', font)

    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const box = { x: 0, y: 0, width: 400, height: 100 }
    const node = graph.createNode('TEXT', page.id, {
      x: 0,
      y: 0,
      width: 400,
      height: 100,
      text: 'AB',
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      fontSize: 20,
      textPathBox: { ...box },
      figmaDerivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 50, y: 50, fontSize: 20, rotation: 0 },
        { commandsBlob: new Uint8Array(4), x: 90, y: 50, fontSize: 20, rotation: 0 }
      ]
    })
    node.source.fig.kiwiNodeType = 'TEXT_PATH'
    node.source.fig.rawNodeFields = {
      vectorData: {
        vectorNetworkBlob: encodeVectorNetworkBlob(straightLineNetwork()),
        normalizedSize: { x: 400, y: 100 }
      },
      textPathStart: { tValue: 0, forward: true }
    }

    const changes = pathTextEditChanges(node, { text: 'Hi', fontSize: 48 })
    const glyphs = expectDefined(changes.figmaDerivedTextGlyphs, 'reflowed glyphs')
    expect(glyphs.length).toBe(2)
    for (const g of glyphs) {
      expect(g.fontSize).toBe(48)
    }
  })
})
