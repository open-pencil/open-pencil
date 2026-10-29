import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'

import { pathTextEditChanges, resizedPathTextGlyphs } from '#core/editor/text/path-edit'
import { getGlyphOutlineMetricsSync } from '#core/text/font/glyphs'
import { fontManager } from '#core/text/fonts'
import { nearestArcPoint, pointAtArc, sampleTextPath, textPathStartArc } from '#core/text/path'

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
    const font = await fontManager.fetchBundledFont('/InterVariable.ttf')
    expect(font).toBeTruthy()
    if (!font) return
    await fontManager.markLoaded('Inter', 'Regular', font)

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
      derivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 50, y: 50, fontSize: 40, rotation: 0 },
        { commandsBlob: new Uint8Array(4), x: 90, y: 50, fontSize: 40, rotation: 0 }
      ]
    })
    node.textPathData = {
      network: straightLineNetwork(),
      normalizedSize: { x: 400, y: 100 },
      tValue: 0,
      forward: true
    }

    const changes = pathTextEditChanges(node, { text: 'Edited' })

    const glyphs = expectDefined(changes.derivedTextGlyphs, 'reflowed glyphs')
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

  test('positions glyphs as HarfBuzz shapes them', async () => {
    const font = await fontManager.fetchBundledFont('/InterVariable.ttf')
    expect(font).toBeTruthy()
    if (!font) return
    await fontManager.markLoaded('Inter', 'Regular', font)

    const metrics = getGlyphOutlineMetricsSync('Inter', 'Regular', 'AV ffi', 40)
    expect(metrics).toBeTruthy()
    expect(metrics?.length).toBeGreaterThan(0)
    for (let index = 1; index < (metrics?.length ?? 0); index++) {
      expect(metrics?.[index]?.x).toBeGreaterThan(metrics?.[index - 1]?.x ?? -Infinity)
    }
  })

  test('folds letterSpacing into the pen-walk advance', async () => {
    const font = await fontManager.fetchBundledFont('/InterVariable.ttf')
    expect(font).toBeTruthy()
    if (!font) return
    await fontManager.markLoaded('Inter', 'Regular', font)

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
        letterSpacing: pixelLength(letterSpacing),
        textPathBox: { ...box },
        derivedTextGlyphs: [
          { commandsBlob: new Uint8Array(4), x: 50, y: 50, fontSize: 40, rotation: 0 },
          { commandsBlob: new Uint8Array(4), x: 90, y: 50, fontSize: 40, rotation: 0 }
        ]
      })
      node.textPathData = {
        network: straightLineNetwork(),
        normalizedSize: { x: 400, y: 100 },
        tValue: 0,
        forward: true
      }
      const changes = pathTextEditChanges(node, { text: 'ABCD' })
      const glyphs = expectDefined(changes.derivedTextGlyphs, 'reflowed glyphs')
      return glyphs[glyphs.length - 1].x
    }

    // Wider tracking pushes the last glyph further along the (straight) path.
    expect(lastGlyphX(20)).toBeGreaterThan(lastGlyphX(0))
  })

  test('clears stale path glyphs when text becomes empty', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const node = graph.createNode('TEXT', page.id, {
      text: 'AB',
      textPathBox: { x: 0, y: 0, width: 100, height: 50 },
      strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: new Uint8Array(4) }],
      derivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 10, y: 20, fontSize: 20, rotation: 0 }
      ]
    })

    expect(pathTextEditChanges(node, { text: '  ' })).toEqual({
      derivedTextGlyphs: null,
      strokeGeometry: []
    })
  })

  test('falls back to {} when the node has no path data', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const node = graph.createNode('TEXT', page.id, {
      text: 'AB',
      derivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 0, y: 0, fontSize: 40, rotation: 0 }
      ]
    })
    // No textPathData / textPathBox — not reflowable.
    expect(pathTextEditChanges(node, { text: 'Edited' })).toEqual({})
  })

  test('uses pending fontSize from the same update batch', async () => {
    const font = await fontManager.fetchBundledFont('/InterVariable.ttf')
    expect(font).toBeTruthy()
    if (!font) return
    await fontManager.markLoaded('Inter', 'Regular', font)

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
      derivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 50, y: 50, fontSize: 20, rotation: 0 },
        { commandsBlob: new Uint8Array(4), x: 90, y: 50, fontSize: 20, rotation: 0 }
      ]
    })
    node.textPathData = {
      network: straightLineNetwork(),
      normalizedSize: { x: 400, y: 100 },
      tValue: 0,
      forward: true
    }

    const changes = pathTextEditChanges(node, { text: 'Hi', fontSize: 48 })
    const glyphs = expectDefined(changes.derivedTextGlyphs, 'reflowed glyphs')
    expect(glyphs.length).toBe(2)
    for (const g of glyphs) {
      expect(g.fontSize).toBe(48)
    }
  })
})

describe('pathTextEditChanges — alignment', () => {
  /** "OO" at 40px on a 400-long straight path, glyph 0 at x = 150, aligned as given. */
  async function alignedText(align: 'LEFT' | 'CENTER' | 'RIGHT', forward = true) {
    const font = await fontManager.fetchBundledFont('/InterVariable.ttf')
    if (!font) throw new Error('missing bundled font')
    await fontManager.markLoaded('Inter', 'Regular', font)
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const node = graph.createNode('TEXT', page.id, {
      width: 400,
      height: 100,
      text: 'OO',
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      fontSize: 40,
      textAlignHorizontal: align,
      textPathBox: { x: 0, y: 0, width: 400, height: 100 },
      derivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 150, y: 50, fontSize: 40, rotation: 0 },
        {
          commandsBlob: new Uint8Array(4),
          x: forward ? 177 : 123,
          y: 50,
          fontSize: 40,
          rotation: 0
        }
      ]
    })
    node.textPathData = {
      network: straightLineNetwork(),
      normalizedSize: { x: 400, y: 100 },
      tValue: 0,
      forward
    }
    return node
  }

  /**
   * Where "OOOO"'s first glyph lands, and where the path puts a point `steps` glyph advances
   * past "OO"'s, one advance being the distance between two of the new glyphs. Two more of the
   * same glyph make the run two advances wider.
   */
  function firstGlyph(node: Awaited<ReturnType<typeof alignedText>>, steps: number) {
    const glyphs = expectDefined(pathTextEditChanges(node, { text: 'OOOO' }).derivedTextGlyphs)
    const path = expectDefined(
      sampleTextPath(expectDefined(node.textPathData), expectDefined(node.textPathBox))
    )
    const [first, second] = glyphs
    const advance = Math.abs(expectDefined(second).x - expectDefined(first).x)
    const start = nearestArcPoint(path, 150, 50).s
    return { x: expectDefined(first).x, expected: pointAtArc(path, start + steps * advance).x }
  }

  test('left-aligned text keeps its start', async () => {
    const { x, expected } = firstGlyph(await alignedText('LEFT'), 0)
    expect(x).toBeCloseTo(expected, 3)
  })

  test('centered text keeps its middle, growing both ways', async () => {
    const { x, expected } = firstGlyph(await alignedText('CENTER'), -1)
    expect(x).toBeCloseTo(expected, 3)
    expect(x).toBeLessThan(140)
  })

  test('right-aligned text keeps its end', async () => {
    const { x, expected } = firstGlyph(await alignedText('RIGHT'), -2)
    expect(x).toBeCloseTo(expected, 3)
  })

  test('text running backwards along the path shifts the other way', async () => {
    const { x, expected } = firstGlyph(await alignedText('RIGHT', false), 2)
    expect(x).toBeCloseTo(expected, 3)
    expect(x).toBeGreaterThan(170)
  })
})

describe('aligned path text is laid out from the text path start, as in Figma', () => {
  /** A straight 400-wide line in two segments; the text starts halfway along the second. */
  function startedOnSecondSegment(
    align: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED',
    forward = true
  ) {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const box = { x: 0, y: 0, width: 400, height: 100 }
    const node = graph.createNode('TEXT', page.id, {
      width: 400,
      height: 100,
      text: 'AB',
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      fontSize: 40,
      textAlignHorizontal: align,
      textPathBox: { ...box },
      derivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 10, y: 50, fontSize: 40, rotation: 0 },
        { commandsBlob: new Uint8Array(4), x: 40, y: 50, fontSize: 40, rotation: 0 }
      ]
    })
    const zero = { x: 0, y: 0 }
    node.textPathData = {
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
      forward,
      startSegment: 1
    }
    return node
  }

  async function edited(align: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED', forward = true) {
    const font = await fontManager.fetchBundledFont('/InterVariable.ttf')
    if (!font) throw new Error('bundled font missing')
    await fontManager.markLoaded('Inter', 'Regular', font)
    const text = 'Hello'
    const width = expectDefined(getGlyphOutlineMetricsSync('Inter', 'Regular', text, 40)).reduce(
      (sum, glyph) => sum + glyph.advance,
      0
    )
    const changes = pathTextEditChanges(startedOnSecondSegment(align, forward), { text })
    const glyphs = expectDefined(changes.derivedTextGlyphs, 'reflowed glyphs')
    return { first: glyphs[0].x, width }
  }

  // The start is halfway along the second segment: x = 300. Arc sampling of a straight cubic is
  // within about 0.35 px, so positions are compared to the nearest pixel.
  test('left-aligned text starts at it', async () => {
    expect((await edited('LEFT')).first).toBeCloseTo(300, 0)
  })

  test('centered text is centered on it', async () => {
    const { first, width } = await edited('CENTER')
    expect(first).toBeCloseTo(300 - width / 2, 0)
  })

  test('right-aligned text ends at it', async () => {
    const { first, width } = await edited('RIGHT')
    expect(first).toBeCloseTo(300 - width, 0)
  })

  test('text running backwards is centered on it from the other side', async () => {
    const { first, width } = await edited('CENTER', false)
    expect(first).toBeCloseTo(300 + width / 2, 0)
  })

  test('justified text on an open path starts at the path’s start', async () => {
    expect((await edited('JUSTIFIED')).first).toBeCloseTo(0, 0)
  })

  test('a new alignment in the same update lays the text out with it', async () => {
    const { width } = await edited('RIGHT')
    const node = startedOnSecondSegment('LEFT')
    const changes = pathTextEditChanges(node, { text: 'Hello', textAlignHorizontal: 'RIGHT' })
    expect(expectDefined(changes.derivedTextGlyphs)[0].x).toBeCloseTo(300 - width, 0)
  })

  test('changing only the alignment lays the text out again', async () => {
    await edited('LEFT')
    const width = expectDefined(getGlyphOutlineMetricsSync('Inter', 'Regular', 'AB', 40)).reduce(
      (sum, glyph) => sum + glyph.advance,
      0
    )
    const changes = pathTextEditChanges(startedOnSecondSegment('LEFT'), {
      textAlignHorizontal: 'CENTER'
    })
    expect(expectDefined(changes.derivedTextGlyphs)[0].x).toBeCloseTo(300 - width / 2, 0)
  })
})

describe('path text that overflows its alignment’s part of the path, as in Figma', () => {
  const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  /** A straight 400-wide line in two segments; the text starts at x = 300. */
  async function overflowing(align: 'LEFT' | 'CENTER' | 'RIGHT', tValue = 0.5) {
    const font = await fontManager.fetchBundledFont('/InterVariable.ttf')
    if (!font) throw new Error('bundled font missing')
    await fontManager.markLoaded('Inter', 'Regular', font)
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0])
    const node = graph.createNode('TEXT', page.id, {
      width: 400,
      height: 100,
      text: 'AB',
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      fontSize: 40,
      textAlignHorizontal: align,
      textPathBox: { x: 0, y: 0, width: 400, height: 100 },
      derivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 10, y: 50, fontSize: 40, rotation: 0 },
        { commandsBlob: new Uint8Array(4), x: 40, y: 50, fontSize: 40, rotation: 0 }
      ]
    })
    const zero = { x: 0, y: 0 }
    node.textPathData = {
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
      tValue,
      forward: true,
      startSegment: 1
    }
    const metrics = expectDefined(getGlyphOutlineMetricsSync('Inter', 'Regular', text, 40))
    const glyphs = expectDefined(pathTextEditChanges(node, { text }).derivedTextGlyphs)
    const kept = metrics.slice(0, glyphs.length)
    const width = kept.reduce((sum, glyph) => sum + glyph.advance, 0)
    const next = metrics.at(glyphs.length)?.advance ?? 0
    return { glyphs, width, next, first: expectDefined(glyphs[0]).x }
  }

  // Each run keeps the leading glyphs that fit its part of the path and is aligned within it, so
  // one more glyph would not fit. Positions are compared to the nearest pixel, as above.
  test('left-aligned text keeps what fits between the start and the path’s end', async () => {
    const { glyphs, width, next, first } = await overflowing('LEFT')
    expect(glyphs.length).toBeLessThan(text.length)
    expect(first).toBeCloseTo(300, 0)
    expect(width).toBeLessThanOrEqual(100 + 0.5)
    expect(width + next).toBeGreaterThan(100)
  })

  test('right-aligned text keeps what fits before the start and ends at it', async () => {
    const { glyphs, width, next, first } = await overflowing('RIGHT')
    expect(glyphs.length).toBeLessThan(text.length)
    expect(first).toBeCloseTo(300 - width, 0)
    expect(width + next).toBeGreaterThan(300)
  })

  test('centered text keeps what fits the widest span centered on the start', async () => {
    // The start is 100 px from the end, so the span is x = 200…400.
    const { glyphs, width, next, first } = await overflowing('CENTER')
    expect(glyphs.length).toBeLessThan(text.length)
    expect(first).toBeCloseTo(300 - width / 2, 0)
    expect(width + next).toBeGreaterThan(200)
  })

  test('a lone first glyph stays even with no room, from where its part starts', async () => {
    // At the path's end, centered text has no room either side.
    const { glyphs, first } = await overflowing('CENTER', 1)
    expect(glyphs.length).toBe(1)
    expect(first).toBeCloseTo(400, 0)
  })
})

test('overflowing text on a closed path keeps what fits one loop', async () => {
  const font = await fontManager.fetchBundledFont('/InterVariable.ttf')
  if (!font) throw new Error('bundled font missing')
  await fontManager.markLoaded('Inter', 'Regular', font)
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0])
  const node = graph.createNode('TEXT', page.id, {
    width: 100,
    height: 100,
    text: 'AB',
    fontFamily: 'Inter',
    fontWeight: 400,
    italic: false,
    fontSize: 40,
    textAlignHorizontal: 'CENTER',
    textPathBox: { x: 0, y: 0, width: 100, height: 100 },
    derivedTextGlyphs: [
      { commandsBlob: new Uint8Array(4), x: 50, y: 0, fontSize: 40, rotation: 0 },
      { commandsBlob: new Uint8Array(4), x: 80, y: 0, fontSize: 40, rotation: 0 }
    ]
  })
  const zero = { x: 0, y: 0 }
  const corners = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ]
  node.textPathData = {
    network: {
      vertices: corners,
      segments: corners.map((_, index) => ({
        start: index,
        end: (index + 1) % corners.length,
        tangentStart: zero,
        tangentEnd: zero
      })),
      regions: []
    },
    normalizedSize: { x: 100, y: 100 },
    tValue: 0.5,
    forward: true,
    startSegment: 0
  }
  const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const metrics = expectDefined(getGlyphOutlineMetricsSync('Inter', 'Regular', text, 40))
  const glyphs = expectDefined(pathTextEditChanges(node, { text }).derivedTextGlyphs)
  const width = metrics.slice(0, glyphs.length).reduce((sum, glyph) => sum + glyph.advance, 0)
  const next = expectDefined(metrics.at(glyphs.length)).advance
  // The loop is 400 long; the kept run is centered on the start at (50, 0) and doesn't lap.
  expect(width).toBeLessThanOrEqual(400 + 0.5)
  expect(width + next).toBeGreaterThan(400)
  const path = expectDefined(
    sampleTextPath(expectDefined(node.textPathData), expectDefined(node.textPathBox))
  )
  const firstArc = nearestArcPoint(path, glyphs[0].x, glyphs[0].y).s
  expect(firstArc).toBeCloseTo((50 - width / 2 + 400) % 400, 0)
})

// A 100 × 100 square path in a Figma file, text starting halfway along its top side. Resizing
// moved old glyphs by their distance along the path, which put letters near the corners on the
// wrong side and scrambled the run once the sides changed length.
describe('resizedPathTextGlyphs — resize lays the text out again', () => {
  test('a squashed or stretched square keeps every letter on the path, in order', async () => {
    const font = await fontManager.fetchBundledFont('/InterVariable.ttf')
    if (!font) throw new Error('expected the bundled Inter font')
    await fontManager.markLoaded('Inter', 'Regular', font)

    const corner = (x: number, y: number) => ({ x, y })
    const side = (start: number, end: number) => ({
      start,
      end,
      tangentStart: corner(0, 0),
      tangentEnd: corner(0, 0)
    })
    const box = { x: 0, y: 0, width: 100, height: 100 }
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', expectDefined(graph.getPages()[0]).id, {
      width: 100,
      height: 100,
      text,
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      fontSize: 18,
      textPathBox: { ...box },
      derivedTextGlyphs: [
        { commandsBlob: new Uint8Array(4), x: 50, y: 0, fontSize: 18, rotation: 0 }
      ]
    })
    node.textPathData = {
      network: {
        vertices: [corner(0, 0), corner(100, 0), corner(100, 100), corner(0, 100)],
        segments: [side(0, 1), side(1, 2), side(2, 3), side(3, 0)],
        regions: []
      },
      normalizedSize: { x: 100, y: 100 },
      tValue: 0.5,
      forward: true,
      startSegment: 0
    }
    const laidOut = expectDefined(pathTextEditChanges(node, { text }).derivedTextGlyphs)
    node.derivedTextGlyphs = laidOut

    for (const size of [
      { width: 273, height: 126 },
      { width: 167, height: 126 },
      { width: 60, height: 300 }
    ]) {
      const resized = { x: 0, y: 0, ...size }
      const glyphs = expectDefined(resizedPathTextGlyphs(node, laidOut, box, resized))
      const path = expectDefined(sampleTextPath(node.textPathData, resized))
      const start = textPathStartArc(node.textPathData, path)
      let previous = -1
      for (const glyph of glyphs) {
        const point = nearestArcPoint(path, glyph.x, glyph.y)
        expect(Math.hypot(point.x - glyph.x, point.y - glyph.y)).toBeLessThan(0.01)
        const along = (point.s - start + path.length) % path.length
        expect(along).toBeGreaterThan(previous)
        previous = along
      }
      expect(glyphs.length).toBeGreaterThan(0)
    }
  })
})
