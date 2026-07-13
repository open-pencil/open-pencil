import { describe, expect, test } from 'bun:test'

import { reactive } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { FigmaDerivedTextGlyph, Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { copyGeometryPaths, copyStrokes } from '@open-pencil/scene-graph/copy'

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

function squareBlob(size: number): Uint8Array {
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

function readBlobX(blob: Uint8Array, cmdIndex: number): number {
  // Each move/line is 9 bytes; second command starts at offset 9, x at +1
  return new DataView(blob.buffer, blob.byteOffset).getFloat32(cmdIndex * 9 + 1, true)
}

describe('resize scales path-text stroke geometry and glyphs', () => {
  test('group resize scales TEXT strokeGeometry + derived glyphs', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const group = graph.createNode('GROUP', page.id, {
      x: 0,
      y: 0,
      width: 200,
      height: 200
    })
    const glyphs: FigmaDerivedTextGlyph[] = [
      {
        commandsBlob: squareBlob(1),
        x: 100,
        y: 50,
        fontSize: 80,
        rotation: -1.5
      }
    ]
    const text = graph.createNode('TEXT', group.id, {
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      text: 'A',
      fills: [BLACK],
      strokes: [WHITE_STROKE],
      strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: squareBlob(200) }],
      figmaDerivedTextGlyphs: glyphs
    })

    const editor = {
      graph,
      renderer: undefined,
      requestRepaint: () => undefined
    } as Editor

    const origChild: OrigChildState = {
      x: text.x,
      y: text.y,
      width: text.width,
      height: text.height,
      vectorNetwork: null,
      fillGeometry: [],
      strokeGeometry: copyGeometryPaths(text.strokeGeometry),
      figmaDerivedTextGlyphs: glyphs.map((g) => ({
        ...g,
        commandsBlob: new Uint8Array(g.commandsBlob)
      })),
      strokes: copyStrokes(text.strokes),
      textPathBox: null
    }

    const drag: DragResize = {
      type: 'resize',
      handle: 'se',
      startX: 200,
      startY: 200,
      origRect: { x: 0, y: 0, width: 200, height: 200 },
      nodeId: group.id,
      origVectorNetwork: null,
      origFillGeometry: [],
      origStrokeGeometry: [],
      origFigmaDerivedTextGlyphs: null,
      origStrokes: [],
      origTextPathBox: null,
      origChildren: new Map([[text.id, origChild]])
    }

    // Scale group to half size
    applyResize(drag, 100, 100, false, editor)

    const resized = expectDefined(graph.getNode(text.id))
    expect(resized.width).toBe(100)
    expect(resized.height).toBe(100)

    // strokeGeometry must scale with the node — otherwise OUTSIDE outlines
    // stay full-size and look massively thick after a shrink.
    const sg = expectDefined(resized.strokeGeometry[0])
    expect(readBlobX(sg.commandsBlob, 1)).toBeCloseTo(100, 3)

    const g0 = expectDefined(resized.figmaDerivedTextGlyphs?.[0])
    expect(g0.x).toBeCloseTo(50, 3)
    expect(g0.y).toBeCloseTo(25, 3)
    // fontSize stays; non-uniform/uniform scale is carried on scaleX/Y
    expect(g0.fontSize).toBeCloseTo(80, 3)
    expect(g0.scaleX).toBeCloseTo(0.5, 3)
    expect(g0.scaleY).toBeCloseTo(0.5, 3)
    expect(g0.rotation).toBeCloseTo(-1.5, 4)

    expect(resized.strokes[0]?.weight).toBeCloseTo(2, 3)
  })

  test('reactive drag state does not leak proxies into the graph', () => {
    // The app stores DragResize in a Vue ref, so commit-time reads through it
    // yield reactive proxies. Writing those into the graph made every
    // structuredClone consumer throw DataCloneError (export subgraph clone).
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const group = graph.createNode('GROUP', page.id, { x: 0, y: 0, width: 200, height: 200 })
    const text = graph.createNode('TEXT', group.id, {
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      text: 'A',
      fills: [BLACK],
      strokes: [WHITE_STROKE],
      strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: squareBlob(200) }],
      figmaDerivedTextGlyphs: [
        { commandsBlob: squareBlob(1), x: 100, y: 50, fontSize: 80, rotation: -1.5 }
      ]
    })

    const editor = {
      graph,
      renderer: undefined,
      requestRepaint: () => undefined,
      updateNode: (id: string, changes: Partial<SceneNode>) => graph.updateNode(id, changes),
      commitGroupResize: () => undefined,
      commitResize: () => undefined
    } as Editor

    const origChild: OrigChildState = {
      x: text.x,
      y: text.y,
      width: text.width,
      height: text.height,
      vectorNetwork: null,
      fillGeometry: [],
      strokeGeometry: copyGeometryPaths(text.strokeGeometry),
      figmaDerivedTextGlyphs: expectDefined(text.figmaDerivedTextGlyphs).map((g) => ({
        ...g,
        commandsBlob: new Uint8Array(g.commandsBlob)
      })),
      strokes: copyStrokes(text.strokes),
      textPathBox: null
    }
    const drag: DragResize = reactive({
      type: 'resize',
      handle: 'se',
      startX: 200,
      startY: 200,
      origRect: { x: 0, y: 0, width: 200, height: 200 },
      nodeId: group.id,
      origVectorNetwork: null,
      origFillGeometry: [],
      origStrokeGeometry: [],
      origFigmaDerivedTextGlyphs: null,
      origStrokes: [],
      origTextPathBox: null,
      origChildren: new Map([[text.id, origChild]])
    }) as DragResize

    applyResize(drag, 100, 100, false, editor)
    commitResizePreview(drag, editor)

    for (const id of [group.id, text.id]) {
      const node = expectDefined(graph.getNode(id))
      for (const key of Object.keys(node) as (keyof SceneNode)[]) {
        expect(() => structuredClone(node[key])).not.toThrow()
      }
    }
  })

  test('width/height resize does not drop derived glyphs', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const glyphs: FigmaDerivedTextGlyph[] = [
      { commandsBlob: squareBlob(1), x: 10, y: 20, fontSize: 40, rotation: -1 }
    ]
    const text = graph.createNode('TEXT', page.id, {
      width: 100,
      height: 100,
      text: 'A',
      figmaDerivedTextGlyphs: glyphs
    })
    text.source.fig.kiwiNodeType = 'TEXT_PATH'

    graph.updateNodePreview(text.id, { width: 50, height: 80 })

    const updated = expectDefined(graph.getNode(text.id))
    expect(updated.figmaDerivedTextGlyphs).not.toBeNull()
    expect(updated.figmaDerivedTextGlyphs).toHaveLength(1)
    expect(updated.source.fig.kiwiNodeType).toBe('TEXT_PATH')
  })
})
