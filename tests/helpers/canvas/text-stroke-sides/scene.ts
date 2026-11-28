import type { SceneGraph, Stroke } from '@open-pencil/scene-graph'
import { polygonBlob } from '@open-pencil/test-support/geometry'

import { solid } from '../paints'

const FONT_SIZE = 60
const WEIGHT = 3

type Edges = readonly [left: number, top: number, right: number, bottom: number]

function contour([left, top, right, bottom]: Edges, reversed = false): Uint8Array {
  const corners = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom }
  ]
  return polygonBlob(reversed ? corners.reverse() : corners)
}

function joined(contours: Uint8Array[]): Uint8Array {
  return new Uint8Array(contours.flatMap((bytes) => [...bytes]))
}

function grow([left, top, right, bottom]: Edges, by: number): Edges {
  return [left - by, top - by, right + by, bottom + by]
}

/** The band Figma saves for a text stroke: `WEIGHT` to either side of an outline. */
function band(edges: Edges): Uint8Array[] {
  return [contour(grow(edges, WEIGHT)), contour(grow(edges, -WEIGHT), true)]
}

const BLOCK: Edges = [0, 0, 0.5, 0.7]
const RING: Edges = [0, 0, 0.6, 0.7]
const COUNTER: Edges = [0.15, 0.15, 0.45, 0.55]
const GLYPHS = [
  { x: 6, outlines: [BLOCK], outline: contour(BLOCK) },
  { x: 48, outlines: [RING, COUNTER], outline: joined([contour(RING), contour(COUNTER, true)]) }
]

/** Glyph outlines are in ems above the baseline; layer space runs down from the layer's top. */
function toLayer([left, top, right, bottom]: Edges, x: number, baseline: number): Edges {
  return [
    x + left * FONT_SIZE,
    baseline - bottom * FONT_SIZE,
    x + right * FONT_SIZE,
    baseline - top * FONT_SIZE
  ]
}

/**
 * Saved square and ring glyphs with an outside, inside and centre stroke, and an outside stroke
 * on a baseline between pixels, drawn from a family no font provider has.
 */
export function createTextStrokeSideScene(graph: SceneGraph, pageId: string): void {
  graph.createNode('RECTANGLE', pageId, {
    x: 20,
    y: 20,
    width: 520,
    height: 140,
    fills: [solid(0.46, 0.49, 0.53)]
  })
  const cases: { align: Stroke['align']; baseline: number }[] = [
    { align: 'OUTSIDE', baseline: 64 },
    { align: 'INSIDE', baseline: 64 },
    { align: 'CENTER', baseline: 64 },
    { align: 'OUTSIDE', baseline: 64.4 }
  ]
  for (const [index, { align, baseline }] of cases.entries()) {
    graph.createNode('TEXT', pageId, {
      x: 40 + index * 125,
      y: 50,
      width: 110,
      height: 80,
      text: 'IO',
      fontFamily: 'Unavailable Visual Test Face',
      fontSize: FONT_SIZE,
      fills: [solid(1, 0.83, 0.23)],
      derivedTextGlyphs: GLYPHS.map((glyph, character) => ({
        commandsBlob: glyph.outline,
        x: glyph.x,
        y: baseline,
        fontSize: FONT_SIZE,
        firstCharacter: character
      })),
      strokeWeight: WEIGHT,
      strokes: [{ ...solid(0.08, 0.08, 0.1), weight: WEIGHT, align }],
      strokeGeometry: [
        {
          windingRule: 'NONZERO',
          commandsBlob: joined(
            GLYPHS.flatMap((glyph) =>
              glyph.outlines.flatMap((outline) => band(toLayer(outline, glyph.x, baseline)))
            )
          )
        }
      ]
    })
  }
}
