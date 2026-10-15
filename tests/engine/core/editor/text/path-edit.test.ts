import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { pathTextEditChanges } from '#core/editor/text/path-edit'
import { fontManager } from '#core/text/fonts'
import { getGlyphOutlineMetricsSync } from '#core/text/opentype'
import { nearestArcPoint, pointAtArc, sampleTextPath } from '#core/text/path'

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

  test('uses opentype.js glyph positioning when the font supports its shaping pipeline', async () => {
    const font = await fontManager.fetchBundledFont('/Inter-Regular.ttf')
    expect(font).toBeTruthy()
    if (!font) return
    fontManager.markLoaded('Inter', 'Regular', font)

    const metrics = getGlyphOutlineMetricsSync('Inter', 'Regular', 'AV ffi', 40)
    expect(metrics).toBeTruthy()
    expect(metrics?.length).toBeGreaterThan(0)
    for (let index = 1; index < (metrics?.length ?? 0); index++) {
      expect(metrics?.[index]?.x).toBeGreaterThan(metrics?.[index - 1]?.x ?? -Infinity)
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
  /** "AB" at 40px on a 400-long straight path, glyph 0 at x = 150, aligned as given. */
  async function alignedText(align: 'LEFT' | 'CENTER' | 'RIGHT', forward = true) {
    const font = await fontManager.fetchBundledFont('/Inter-Regular.ttf')
    if (!font) throw new Error('missing bundled font')
    fontManager.markLoaded('Inter', 'Regular', font)
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

  /** How much wider "ABCD" is than "AB", measured as the reflow measures them. */
  function growth() {
    const width = (text: string) =>
      expectDefined(getGlyphOutlineMetricsSync('Inter', 'Regular', text, 40)).reduce(
        (sum, glyph) => sum + glyph.advance,
        0
      )
    return width('ABCD') - width('AB')
  }

  /** Where "ABCD"'s first glyph lands, and where the path puts a point `shift` past "AB"'s. */
  function firstGlyph(node: Awaited<ReturnType<typeof alignedText>>, shift: number) {
    const glyphs = expectDefined(pathTextEditChanges(node, { text: 'ABCD' }).derivedTextGlyphs)
    const path = expectDefined(
      sampleTextPath(expectDefined(node.textPathData), expectDefined(node.textPathBox))
    )
    const start = nearestArcPoint(path, 150, 50).s
    return { x: expectDefined(glyphs[0]).x, expected: pointAtArc(path, start + shift).x }
  }

  test('left-aligned text keeps its start', async () => {
    const { x, expected } = firstGlyph(await alignedText('LEFT'), 0)
    expect(x).toBeCloseTo(expected, 6)
  })

  test('centered text keeps its middle, growing both ways', async () => {
    const { x, expected } = firstGlyph(await alignedText('CENTER'), -growth() / 2)
    expect(x).toBeCloseTo(expected, 6)
    expect(x).toBeLessThan(140)
  })

  test('right-aligned text keeps its end', async () => {
    const { x, expected } = firstGlyph(await alignedText('RIGHT'), -growth())
    expect(x).toBeCloseTo(expected, 6)
  })

  test('text running backwards along the path shifts the other way', async () => {
    const { x, expected } = firstGlyph(await alignedText('RIGHT', false), growth())
    expect(x).toBeCloseTo(expected, 6)
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
    const font = await fontManager.fetchBundledFont('/Inter-Regular.ttf')
    if (!font) throw new Error('bundled font missing')
    fontManager.markLoaded('Inter', 'Regular', font)
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
})
