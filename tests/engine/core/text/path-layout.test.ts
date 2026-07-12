import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { VectorNetwork } from '@open-pencil/scene-graph'

import { parseFigFile } from '#core/io/formats/fig/read'
import {
  calibratePathTextLayout,
  getTextPathData,
  layoutPathTextFromAdvances,
  reflowPathTextGlyphs,
  sampleTextPath
} from '#core/text/path-layout'
import { encodeVectorNetworkBlob } from '#core/vector'

import { expectDefined } from '#tests/helpers/assert'

/** Signed shortest angular difference a - b. */
function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b))
}

const LOCAL_CIRCLE_TEXT = '/Users/rcoenen/Downloads/ArnoWithCircleText.fig'

describe('path-text reflow — real fixture (optional local)', () => {
  test('identity reflow reproduces baked glyphs; anisotropic reflow re-places without touching outlines', async () => {
    if (!existsSync(LOCAL_CIRCLE_TEXT)) {
      console.log('skip: ArnoWithCircleText.fig not present')
      return
    }

    const bytes = readFileSync(LOCAL_CIRCLE_TEXT)
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    const graph = await parseFigFile(ab)
    const node = expectDefined(
      [...graph.getAllNodes()].find((n) => n.name === 'ArnoCoenen.art'),
      'path text node'
    )
    const data = expectDefined(getTextPathData(node), 'text path data')
    const box = expectDefined(node.textPathBox, 'textPathBox')
    const glyphs = expectDefined(node.figmaDerivedTextGlyphs, 'imported glyphs')
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
    node.source.fig.kiwiNodeType = 'TEXT_PATH'
    node.source.fig.rawNodeFields = {
      vectorData: {
        vectorNetworkBlob: encodeVectorNetworkBlob(circleNetwork()),
        normalizedSize: { x: 256, y: 256 }
      },
      textPathStart: { tValue: 0.25, forward: false }
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
