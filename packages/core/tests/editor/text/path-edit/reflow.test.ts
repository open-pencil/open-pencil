import { describe, expect, test } from 'bun:test'

import { straightLineNetwork } from '#core-tests/helpers/text/path'

import { SceneGraph } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'
import { expectDefined } from '@open-pencil/test-support/assert'

import { pathTextEditChanges, resizedPathTextGlyphs } from '#core/editor/text/path-edit'
import { getGlyphOutlineMetricsSync } from '#core/text/font/glyphs'
import { fontManager } from '#core/text/font/manager'
import { nearestArcPoint, sampleTextPath, textPathStartArc } from '#core/text/path'

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
