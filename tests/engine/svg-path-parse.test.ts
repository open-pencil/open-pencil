import { describe, expect, test } from 'bun:test'

import { parseSVGPath, vectorNetworkToSVGPaths } from '@open-pencil/core'

describe('parseSVGPath', () => {
  test('simple rectangle M L L L Z', () => {
    const vn = parseSVGPath('M0 0 L10 0 L10 10 L0 10 Z')
    expect(vn.vertices.length).toBe(4)
    expect(vn.segments.length).toBe(4)
    expect(vn.regions.length).toBe(1)
    expect(vn.regions[0].windingRule).toBe('NONZERO')
    expect(vn.regions[0].loops.length).toBe(1)
    expect(vn.regions[0].loops[0].length).toBe(4)
  })

  test('H and V commands', () => {
    const vn = parseSVGPath('M0 0 H10 V10 H0 Z')
    expect(vn.vertices.length).toBe(4)
    expect(vn.segments.length).toBe(4)
  })

  test('relative commands (m l h v z)', () => {
    const vn = parseSVGPath('m0 0 l10 0 l0 10 l-10 0 z')
    expect(vn.vertices.length).toBe(4)
    expect(vn.segments.length).toBe(4)
    expect(vn.regions[0].loops[0].length).toBe(4)
  })

  test('cubic bezier C command', () => {
    const vn = parseSVGPath('M0 0 C10 0 10 10 0 10')
    expect(vn.vertices.length).toBe(2)
    expect(vn.segments.length).toBe(1)
    const seg = vn.segments[0]
    expect(seg.tangentStart.x).toBeCloseTo(10)
    expect(seg.tangentStart.y).toBeCloseTo(0)
    expect(seg.tangentEnd.x).toBeCloseTo(10)
    expect(seg.tangentEnd.y).toBeCloseTo(0)
  })

  test('smooth cubic S command → expanded to C', () => {
    const vn = parseSVGPath('M0 0 C5 0 10 5 10 10 S20 20 20 10')
    expect(vn.segments.length).toBe(2)
  })

  test('quadratic Q command → converted to cubic', () => {
    const vn = parseSVGPath('M0 0 Q10 10 20 0')
    expect(vn.segments.length).toBe(1)
    const seg = vn.segments[0]
    expect(seg.tangentStart.x).not.toBe(0)
    expect(seg.tangentEnd.x).not.toBe(0)
  })

  test('arc A command → converted to cubics', () => {
    const vn = parseSVGPath('M10 0 A10 10 0 0 1 0 10')
    expect(vn.segments.length).toBeGreaterThanOrEqual(1)
    expect(vn.vertices.length).toBeGreaterThanOrEqual(2)
  })

  test('evenodd winding rule', () => {
    const vn = parseSVGPath('M0 0 L10 0 L10 10 Z', 'EVENODD')
    expect(vn.regions[0].windingRule).toBe('EVENODD')
  })

  test('multiple subpaths → multiple loops in one region', () => {
    const vn = parseSVGPath('M0 0 L10 0 L10 10 Z M20 20 L30 20 L30 30 Z')
    expect(vn.regions.length).toBe(1)
    expect(vn.regions[0].loops.length).toBe(2)
  })

  test('open subpath → no region', () => {
    const vn = parseSVGPath('M0 0 L10 0 L10 10')
    expect(vn.regions.length).toBe(0)
    expect(vn.segments.length).toBe(2)
  })

  test('straight segments have zero tangents', () => {
    const vn = parseSVGPath('M0 0 L10 10')
    const seg = vn.segments[0]
    expect(seg.tangentStart.x).toBe(0)
    expect(seg.tangentStart.y).toBe(0)
    expect(seg.tangentEnd.x).toBe(0)
    expect(seg.tangentEnd.y).toBe(0)
  })

  test('real icon: mdi:home path', () => {
    const d = 'M10 20v-6h4v6h5v-8h3L12 3L2 12h3v8z'
    const vn = parseSVGPath(d)
    expect(vn.vertices.length).toBeGreaterThan(3)
    expect(vn.segments.length).toBeGreaterThan(3)
    expect(vn.regions.length).toBe(1)
  })

  test('real icon: lucide heart path (arcs + curves)', () => {
    const d = 'M2 9.5a5.5 5.5 0 0 1 9.591-3.676a.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5'
    const vn = parseSVGPath(d)
    expect(vn.vertices.length).toBeGreaterThan(5)
    expect(vn.segments.length).toBeGreaterThan(5)
  })

  test('round-trip: parse → export produces valid SVG paths', () => {
    const d = 'M0 0 L100 0 L100 100 L0 100 Z'
    const vn = parseSVGPath(d)
    const exported = vectorNetworkToSVGPaths(vn)
    expect(exported.length).toBe(1)
    expect(exported[0]).toContain('M')
    expect(exported[0]).toContain('Z')
  })
})
