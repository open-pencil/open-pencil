import { describe, expect, test } from 'bun:test'

import type { Editor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Fill, SceneNode, Stroke, VectorNetwork } from '@open-pencil/scene-graph'
import { copyGeometryPaths, copyStrokes } from '@open-pencil/scene-graph/copy'

import { getTextPathData, layoutPathTextFromAdvances } from '#core/text/path-layout'
import { encodeVectorNetworkBlob } from '#core/vector'
import { applyResize, commitResizePreview } from '#vue/shared/input/resize'
import type { DragResize, OrigChildState } from '#vue/shared/input/types'

import { expectDefined } from '#tests/helpers/assert'

const BLACK: Fill = {
  type: 'SOLID',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL'
}

const WHITE_STROKE: Stroke = {
  color: { r: 1, g: 1, b: 1, a: 1 },
  weight: 4,
  opacity: 1,
  visible: true,
  align: 'OUTSIDE',
  cap: 'NONE',
  join: 'MITER',
  dashPattern: []
}

const KAPPA = 0.5523

/** 4-cubic circle, radius 100 centered (128,128), in 256x256 normalized space. */
function circleNetwork(): VectorNetwork {
  const c = 128
  const r = 100
  const k = r * KAPPA
  return {
    vertices: [
      { x: c + r, y: c },
      { x: c, y: c + r },
      { x: c - r, y: c },
      { x: c, y: c - r }
    ],
    segments: [
      { start: 0, end: 1, tangentStart: { x: 0, y: k }, tangentEnd: { x: k, y: 0 } },
      { start: 1, end: 2, tangentStart: { x: -k, y: 0 }, tangentEnd: { x: 0, y: k } },
      { start: 2, end: 3, tangentStart: { x: 0, y: -k }, tangentEnd: { x: -k, y: 0 } },
      { start: 3, end: 0, tangentStart: { x: k, y: 0 }, tangentEnd: { x: 0, y: -k } }
    ],
    regions: []
  }
}

/** Minimal move+line outline blob — layout never reads its contents. */
function glyphBlob(): Uint8Array {
  const blob = new Uint8Array(2 * 9)
  const view = new DataView(blob.buffer)
  blob[0] = 1
  view.setFloat32(1, 0, true)
  view.setFloat32(5, 0, true)
  blob[9] = 2
  view.setFloat32(10, 1, true)
  view.setFloat32(14, 0, true)
  return blob
}

function squareGeometryBlob(size: number): Uint8Array {
  const blob = new Uint8Array(1 + 4 * 9 + 1)
  const view = new DataView(blob.buffer)
  const pts = [
    [1, 0, 0],
    [2, size, 0],
    [2, size, size],
    [2, 0, size]
  ] as const
  let o = 0
  for (const [cmd, x, y] of pts) {
    blob[o] = cmd
    view.setFloat32(o + 1, x, true)
    view.setFloat32(o + 5, y, true)
    o += 9
  }
  blob[o] = 0
  return blob
}

describe('group resize reflows path text instead of squashing it', () => {
  test('non-uniform group resize: box scales, strokeGeometry clears, glyphs carry no scale', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const group = graph.createNode('GROUP', page.id, { x: 0, y: 0, width: 256, height: 256 })
    const box = { x: 0, y: 0, width: 256, height: 256 }
    const text = graph.createNode('TEXT', group.id, {
      x: 0,
      y: 0,
      width: 256,
      height: 256,
      text: 'abc',
      fills: [BLACK],
      strokes: [WHITE_STROKE],
      strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: squareGeometryBlob(256) }],
      textPathBox: { ...box }
    })
    text.source.fig.kiwiNodeType = 'TEXT_PATH'
    text.source.fig.rawNodeFields = {
      vectorData: {
        vectorNetworkBlob: encodeVectorNetworkBlob(circleNetwork()),
        normalizedSize: { x: 256, y: 256 }
      },
      textPathStart: { tValue: 0.25, forward: false }
    }

    const data = expectDefined(getTextPathData(text), 'synthetic path data')
    const seeds = expectDefined(
      layoutPathTextFromAdvances(data, box, 0.25, 0, [
        { commandsBlob: glyphBlob(), fontSize: 40, advance: 0.6 },
        { commandsBlob: glyphBlob(), fontSize: 40, advance: 0.6 },
        { commandsBlob: glyphBlob(), fontSize: 40, advance: 0.6 }
      ]),
      'seed glyphs'
    )
    text.figmaDerivedTextGlyphs = seeds.map((g) => ({
      ...g,
      commandsBlob: new Uint8Array(g.commandsBlob)
    }))

    const editor = {
      graph,
      renderer: undefined,
      requestRepaint: () => undefined,
      updateNode: (id: string, changes: Partial<SceneNode>) => graph.updateNode(id, changes),
      commitResize: () => undefined,
      commitGroupResize: () => undefined
    } as Editor

    const origChild: OrigChildState = {
      x: 0,
      y: 0,
      width: 256,
      height: 256,
      vectorNetwork: null,
      fillGeometry: [],
      strokeGeometry: copyGeometryPaths(text.strokeGeometry),
      figmaDerivedTextGlyphs: seeds.map((g) => ({
        ...g,
        commandsBlob: new Uint8Array(g.commandsBlob)
      })),
      strokes: copyStrokes(text.strokes),
      textPathBox: { ...box }
    }

    const drag: DragResize = {
      type: 'resize',
      handle: 'se',
      startX: 256,
      startY: 256,
      origRect: { x: 0, y: 0, width: 256, height: 256 },
      nodeId: group.id,
      origVectorNetwork: null,
      origFillGeometry: [],
      origStrokeGeometry: [],
      origFigmaDerivedTextGlyphs: null,
      origStrokes: [],
      origTextPathBox: null,
      origChildren: new Map([[text.id, origChild]])
    }

    // Drag the SE handle right by 256px: 256x256 -> 512x256 (non-uniform).
    applyResize(drag, 512, 256, false, editor)
    commitResizePreview(drag, editor)

    const committed = expectDefined(graph.getNode(text.id), 'committed text node')
    expect(committed.width).toBe(512)
    expect(committed.height).toBe(256)

    // textPathBox scaled x2 in width only.
    const tpb = expectDefined(committed.textPathBox, 'committed textPathBox')
    expect(tpb.x).toBeCloseTo(0, 3)
    expect(tpb.y).toBeCloseTo(0, 3)
    expect(tpb.width).toBeCloseTo(512, 3)
    expect(tpb.height).toBeCloseTo(256, 3)

    // Reflow cleared the baked silhouettes — the renderer rebuilds per glyph.
    expect(committed.strokeGeometry).toEqual([])

    const glyphs = expectDefined(committed.figmaDerivedTextGlyphs, 'committed glyphs')
    expect(glyphs).toHaveLength(3)
    for (const g of glyphs) {
      expect(g.scaleX).toBeUndefined()
      expect(g.scaleY).toBeUndefined()
      expect(g.fontSize).toBeCloseTo(40, 3)
    }
    // The wider path actually re-placed the glyphs.
    expect(glyphs.some((g, i) => Math.hypot(g.x - seeds[i].x, g.y - seeds[i].y) > 1)).toBe(true)

    // Reflow keeps stroke weight constant (like font size).
    expect(committed.strokes[0]?.weight).toBeCloseTo(4, 3)

    // Undo payloads snapshot graph state via structuredClone — the committed
    // nodes must not carry proxies or non-clonable values.
    expect(() => structuredClone(committed)).not.toThrow()
    expect(() => structuredClone(expectDefined(graph.getNode(group.id)))).not.toThrow()
  })
})
