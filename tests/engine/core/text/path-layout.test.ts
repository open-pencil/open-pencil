import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode, TextPathData, VectorNetwork } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  calibratePathTextLayout,
  fitTextPathBoxToGlyphs,
  getTextPathData,
  layoutPathTextFromAdvances,
  pointAtArc,
  reflowPathTextGlyphs,
  sampleTextPath,
  textPathStartArc
} from '#core/text/path'

import { expectDefined } from '#tests/helpers/assert'
import { loadFigFixture } from '#tests/helpers/fig/fixtures'

/** Signed shortest angular difference a - b. */
function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b))
}

const LOCAL_CIRCLE_TEXT = 'tests/fixtures/circle-text.fig'

describe('path-text reflow — real fixture (optional local)', () => {
  test('identity reflow reproduces baked glyphs; anisotropic reflow re-places without touching outlines', async () => {
    const graph = await loadFigFixture(LOCAL_CIRCLE_TEXT)
    if (!graph) return
    const node = expectDefined(
      [...graph.getAllNodes()].find((n) => n.name === 'ArnoCoenen.art'),
      'path text node'
    )
    const data = expectDefined(getTextPathData(node), 'text path data')
    const box = expectDefined(node.textPathBox, 'textPathBox')
    const glyphs = expectDefined(node.derivedTextGlyphs, 'imported glyphs')
    expect(glyphs.length).toBeGreaterThan(0)

    const layout = expectDefined(calibratePathTextLayout(glyphs, data, box), 'layout')

    // Identity reflow (same box) must reproduce every baked glyph.
    const identity = expectDefined(
      reflowPathTextGlyphs(glyphs, data, layout, box),
      'identity reflow'
    )
    expect(identity).toHaveLength(glyphs.length)
    for (let i = 0; i < glyphs.length; i++) {
      const dist = Math.hypot(identity[i].x - glyphs[i].x, identity[i].y - glyphs[i].y)
      expect(dist).toBeLessThan(1)
      const rot = Math.abs(angleDiff(identity[i].rotation ?? 0, glyphs[i].rotation ?? 0))
      expect(rot).toBeLessThan(0.01)
    }

    // Anisotropic reflow: 0.5x width, 1.0x height.
    const half = { x: box.x * 0.5, y: box.y, width: box.width * 0.5, height: box.height }
    const reflowed = expectDefined(
      reflowPathTextGlyphs(glyphs, data, layout, half),
      'anisotropic reflow'
    )
    let changedPairs = 0
    let pairs = 0
    for (let i = 0; i < glyphs.length; i++) {
      // Re-layout, not geometric squash: no residual glyph scale...
      expect(reflowed[i].scaleX).toBeUndefined()
      expect(reflowed[i].scaleY).toBeUndefined()
      // ...and the outline blob itself is byte-identical to the source glyph's.
      expect(
        Buffer.from(reflowed[i].commandsBlob).equals(Buffer.from(glyphs[i].commandsBlob))
      ).toBe(true)
      for (let j = i + 1; j < glyphs.length; j++) {
        pairs++
        const before = Math.hypot(glyphs[i].x - glyphs[j].x, glyphs[i].y - glyphs[j].y)
        const after = Math.hypot(reflowed[i].x - reflowed[j].x, reflowed[i].y - reflowed[j].y)
        if (Math.abs(after - before) > 1) changedPairs++
      }
    }
    // Glyphs moved relative to each other — the layout changed, the shapes did not.
    expect(pairs).toBeGreaterThan(0)
    expect(changedPairs).toBeGreaterThan(0)
  })

  // Task 3.3 / 4.1: the selection overlay strokes sampleTextPath(data, fitted),
  // where `fitted` = fitTextPathBoxToGlyphs. Guard that the fitted curve tracks
  // the imported glyph baselines TIGHTLY — the raw textPathBox is ~4% too small
  // and sits ~30px off (the visible offset bug this fit corrects).
  function maxGlyphToPath(
    path: { xs: Float64Array; ys: Float64Array },
    glyphs: SceneNode['derivedTextGlyphs'] & object
  ) {
    let max = 0
    for (const g of glyphs) {
      let best = Infinity
      for (let s = 0; s < path.xs.length; s++) {
        best = Math.min(best, Math.hypot(path.xs[s] - g.x, path.ys[s] - g.y))
      }
      max = Math.max(max, best)
    }
    return max
  }

  test('fitted overlay curve + start marker track the imported glyph baselines', async () => {
    const graph = await loadFigFixture(LOCAL_CIRCLE_TEXT)
    if (!graph) return
    const node = expectDefined(
      [...graph.getAllNodes()].find((n) => n.name === 'ArnoCoenen.art'),
      'path text node'
    )
    const data = expectDefined(getTextPathData(node), 'text path data')
    const box = expectDefined(node.textPathBox, 'textPathBox')
    const glyphs = expectDefined(node.derivedTextGlyphs, 'imported glyphs')

    // Raw textPathBox path is materially off the glyphs (the bug).
    const rawPath = expectDefined(sampleTextPath(data, box), 'raw path')
    expect(maxGlyphToPath(rawPath, glyphs)).toBeGreaterThan(15)

    // The fitted box lands the path ON the glyph baselines.
    const fitted = expectDefined(fitTextPathBoxToGlyphs(data, box, glyphs), 'fitted box')
    // Aspect preserved from textPathBox, so the overlay ovals under a non-uniform
    // resize instead of forcing a circle.
    expect(fitted.width / fitted.height).toBeCloseTo(box.width / box.height, 3)
    const path = expectDefined(sampleTextPath(data, fitted), 'fitted overlay path')
    expect(maxGlyphToPath(path, glyphs)).toBeLessThan(12)

    // The start marker sits on the segment Figma marks, near arc 595 of 1540, not at
    // tValue × length (845.7), where this centered run's first glyph happens to be.
    expect(data.startSegment).toBe(1)
    expect(textPathStartArc(data, rawPath)).toBeCloseTo(595, 0)
  })

  test('fitTextPathBoxToGlyphs returns null with no glyphs to fit', async () => {
    const graph = await loadFigFixture(LOCAL_CIRCLE_TEXT)
    if (!graph) return
    const node = expectDefined(
      [...graph.getAllNodes()].find((n) => n.name === 'ArnoCoenen.art'),
      'path text node'
    )
    const data = expectDefined(getTextPathData(node), 'text path data')
    const box = expectDefined(node.textPathBox, 'textPathBox')
    expect(fitTextPathBoxToGlyphs(data, box, [])).toBeNull()
    expect(fitTextPathBoxToGlyphs(data, box, null)).toBeNull()
  })
})

// --- Synthetic circle path (always runs) ---

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

describe('path-text reflow — synthetic circle', () => {
  test('reflowed glyphs stay on the scaled path with tangent-derived rotations', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const box = { x: 0, y: 0, width: 256, height: 256 }
    const node = graph.createNode('TEXT', page.id, {
      x: 0,
      y: 0,
      width: 256,
      height: 256,
      text: 'abc',
      textPathBox: { ...box }
    })
    node.textPathData = {
      network: circleNetwork(),
      normalizedSize: { x: 256, y: 256 },
      tValue: 0.25,
      forward: false
    }

    const data = expectDefined(getTextPathData(node), 'synthetic path data')
    expect(data.forward).toBe(false)

    // Seed glyphs with the engine's own pen walk so the test is self-consistent.
    const seeds = expectDefined(
      layoutPathTextFromAdvances(data, box, 0.25, 0, [
        { commandsBlob: glyphBlob(), fontSize: 40, advance: 0.6 },
        { commandsBlob: glyphBlob(), fontSize: 40, advance: 0.6 },
        { commandsBlob: glyphBlob(), fontSize: 40, advance: 0.6 }
      ]),
      'seed glyphs'
    )
    expect(seeds).toHaveLength(3)

    const layout = expectDefined(calibratePathTextLayout(seeds, data, box), 'layout')

    // Identity round-trip: calibrate → reflow on the same box reproduces the seeds.
    const identity = expectDefined(reflowPathTextGlyphs(seeds, data, layout, box), 'identity')
    for (let i = 0; i < seeds.length; i++) {
      expect(Math.hypot(identity[i].x - seeds[i].x, identity[i].y - seeds[i].y)).toBeLessThan(1)
      expect(Math.abs(angleDiff(identity[i].rotation ?? 0, seeds[i].rotation ?? 0))).toBeLessThan(
        0.01
      )
    }

    // Reflow into a 2x-wide box.
    const wide = { x: 0, y: 0, width: 512, height: 256 }
    const reflowed = expectDefined(reflowPathTextGlyphs(seeds, data, layout, wide), 'reflow')
    const path = expectDefined(sampleTextPath(data, wide), 'sampled wide path')

    for (let i = 0; i < reflowed.length; i++) {
      const g = reflowed[i]
      expect(g.scaleX).toBeUndefined()
      expect(g.scaleY).toBeUndefined()

      // Nearest sampled path point — glyph baselines must sit on the scaled path.
      let best = 0
      let bestD = Infinity
      for (let s = 0; s < path.xs.length; s++) {
        const d = Math.hypot(path.xs[s] - g.x, path.ys[s] - g.y)
        if (d < bestD) {
          bestD = d
          best = s
        }
      }
      expect(bestD).toBeLessThan(2)

      // Rotation follows the LOCAL tangent (negated: forward=false) plus the
      // calibrated phase for this glyph.
      const a = Math.max(0, best - 1)
      const b = Math.min(path.xs.length - 1, best + 1)
      const tx = -(path.xs[b] - path.xs[a])
      const ty = -(path.ys[b] - path.ys[a])
      const expected = -Math.atan2(ty, tx) + layout.phases[i]
      expect(Math.abs(angleDiff(g.rotation ?? 0, expected))).toBeLessThan(0.05)
    }

    // The wider path actually moved the glyphs.
    expect(reflowed.some((g, i) => Math.hypot(g.x - seeds[i].x, g.y - seeds[i].y) > 1)).toBe(true)
  })
})

// --- Selection overlay: shared path helpers + eligibility (task 3.1/3.2) ---

/** Build the synthetic circle TEXT_PATH node used across overlay tests. */
function makeCircleTextPathNode(tValue = 0, forward = true): SceneNode {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0])
  const node = graph.createNode('TEXT', page.id, {
    x: 0,
    y: 0,
    width: 256,
    height: 256,
    text: 'abc',
    textPathBox: { x: 0, y: 0, width: 256, height: 256 }
  })
  node.textPathData = {
    network: circleNetwork(),
    normalizedSize: { x: 256, y: 256 },
    tValue,
    forward
  }
  return node
}

describe('selection overlay — path helpers', () => {
  test('pointAtArc lands on the curve at an arc fraction (start-marker geometry)', () => {
    const node = makeCircleTextPathNode()
    const data = expectDefined(getTextPathData(node), 'data')
    const box = expectDefined(node.textPathBox, 'box')
    const path = expectDefined(sampleTextPath(data, box), 'path')

    // Radius-100 circle centered at (128,128): every arc point is 100 from center.
    const start = pointAtArc(path, 0)
    expect(Math.hypot(start.x - 128, start.y - 128)).toBeCloseTo(100, 0)

    const mid = pointAtArc(path, 0.25 * path.length)
    expect(Math.hypot(mid.x - 128, mid.y - 128)).toBeCloseTo(100, 0)
    // Moved along the arc from the start.
    expect(Math.hypot(mid.x - start.x, mid.y - start.y)).toBeGreaterThan(1)
  })

  test('the start marker sits on the marked start segment, or at tValue along an unmarked path', () => {
    const zero = { x: 0, y: 0 }
    const data: TextPathData = {
      network: {
        vertices: [
          { x: 0, y: 50 },
          { x: 200, y: 50 },
          { x: 400, y: 50 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: zero, tangentEnd: zero },
          { start: 1, end: 2, tangentStart: zero, tangentEnd: zero }
        ],
        regions: []
      },
      normalizedSize: { x: 400, y: 100 },
      tValue: 0.5,
      forward: true,
      startSegment: 1
    }
    const box = { x: 0, y: 0, width: 400, height: 100 }
    const path = expectDefined(sampleTextPath(data, box), 'path')

    expect(textPathStartArc(data, path)).toBeCloseTo(300, 0)
    expect(textPathStartArc({ ...data, startSegment: undefined }, path)).toBeCloseTo(200, 0)
  })

  test('eligible node samples the curve (not a rectangle); dataless node falls back', () => {
    const node = makeCircleTextPathNode()
    // Overlay eligibility seam: retained data + a node-local box are both present.
    const data = expectDefined(getTextPathData(node), 'data')
    const box = expectDefined(node.textPathBox, 'box')
    const path = expectDefined(sampleTextPath(data, box), 'path')

    // Curve, not rectangle: every sample sits at ~radius 100 from box center;
    // a bounding rectangle would give corner distances ~181 and edges 100.
    let rMin = Infinity
    let rMax = 0
    for (let i = 0; i < path.xs.length; i++) {
      const rr = Math.hypot(path.xs[i] - 128, path.ys[i] - 128)
      rMin = Math.min(rMin, rr)
      rMax = Math.max(rMax, rr)
    }
    expect(rMax - rMin).toBeLessThan(1)
    expect(Math.abs(rMax - 100)).toBeLessThan(1)

    // Ineligible: no materialized path data → null → the overlay branch is
    // skipped and drawNodeSelection (rectangle) runs.
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const bare = graph.createNode('TEXT', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      text: 'x'
    })
    expect(getTextPathData(bare)).toBeNull()
  })
})

describe('pen-walked glyph rotation', () => {
  const zero = { x: 0, y: 0 }
  /** Right 100, then down 100: 200 long, turning a quarter at (100, 50). */
  function corner(forward = true) {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 50 },
        { x: 100, y: 50 },
        { x: 100, y: 150 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: zero, tangentEnd: zero },
        { start: 1, end: 2, tangentStart: zero, tangentEnd: zero }
      ],
      regions: []
    }
    const data = { network, normalizedSize: { x: 400, y: 200 }, tValue: 0, forward }
    const box = { x: 0, y: 0, width: 400, height: 200 }
    return { data, box, path: expectDefined(sampleTextPath(data, box)) }
  }
  /** A glyph 20 wide at font size 40. */
  const source = { commandsBlob: new Uint8Array(4), fontSize: 40, advance: 0.5 }
  const chordBetween = (a: Vector, b: Vector) => -Math.atan2(b.y - a.y, b.x - a.x)

  test('a glyph on text running backwards turns along its chord the other way', () => {
    const { data, box, path } = corner(false)
    // Starts 10 past the corner and runs back to 10 before it.
    const [glyph] = expectDefined(
      layoutPathTextFromAdvances(data, box, 110 / path.length, 0, [source])
    )
    const chord = chordBetween(pointAtArc(path, 110), pointAtArc(path, 90))
    expect(Math.abs(angleDiff(expectDefined(glyph.rotation), chord))).toBeLessThan(1e-9)
  })

  test('a glyph past the end of an open path turns along what is left of it', () => {
    const { data, box, path } = corner()
    // Starts 5 before the end; the rest of it hangs past the end, which stays put.
    const [glyph] = expectDefined(
      layoutPathTextFromAdvances(data, box, 195 / path.length, 0, [source])
    )
    expect(Math.abs(angleDiff(expectDefined(glyph.rotation), -Math.PI / 2))).toBeLessThan(1e-9)
  })

  test('a resize turns the glyphs along their new chords, as re-laying them out does', () => {
    const { data, box, path } = corner()
    const glyphs = expectDefined(
      layoutPathTextFromAdvances(data, box, 80 / path.length, 0, [source, source, source])
    )
    const layout = expectDefined(calibratePathTextLayout(glyphs, data, box))
    // Half as wide: the first leg shortens and the corner bends at a different angle.
    const narrow = { ...box, width: box.width / 2 }
    const reflowed = expectDefined(reflowPathTextGlyphs(glyphs, data, layout, narrow))
    const fresh = expectDefined(
      layoutPathTextFromAdvances(data, narrow, layout.anchor, 0, [source, source, source])
    )
    for (const [index, glyph] of reflowed.entries()) {
      const rotation = expectDefined(glyph.rotation)
      expect(Math.abs(angleDiff(rotation, expectDefined(fresh[index].rotation)))).toBeLessThan(1e-6)
    }
  })

  test('a glyph turns along the line from where it starts on the path to where it ends', () => {
    const zero = { x: 0, y: 0 }
    // Right 100, then down 100: 200 long, turning a quarter at (100, 50).
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 50 },
        { x: 100, y: 50 },
        { x: 100, y: 150 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: zero, tangentEnd: zero },
        { start: 1, end: 2, tangentStart: zero, tangentEnd: zero }
      ],
      regions: []
    }
    const data = { network, normalizedSize: { x: 400, y: 200 }, tValue: 0, forward: true }
    const box = { x: 0, y: 0, width: 400, height: 200 }
    const source = { commandsBlob: new Uint8Array(4), fontSize: 40, advance: 0.5 }
    const path = expectDefined(sampleTextPath(data, box))
    // The glyph starts 10 before the corner and, 20 wide, ends 10 past it.
    const [straddling] = expectDefined(
      layoutPathTextFromAdvances(data, box, 90 / path.length, 0, [source])
    )
    const start = pointAtArc(path, 90)
    const end = pointAtArc(path, 110)
    const chord = -Math.atan2(end.y - start.y, end.x - start.x)
    expect(Math.abs(angleDiff(expectDefined(straddling.rotation), chord))).toBeLessThan(1e-9)
    // Close to a half turn of the corner, not level with the first leg as its left edge is.
    expect(Math.abs(angleDiff(expectDefined(straddling.rotation), -Math.PI / 4))).toBeLessThan(0.05)
  })
})
