import { describe, test, expect } from 'bun:test'

import { parseSVGFile } from '@open-pencil/core'

describe('parseSVGFile', () => {
  test('SVG with single path and viewBox', () => {
    const svg = '<svg viewBox="0 0 100 100"><path d="M10 10L90 90"/></svg>'
    const result = parseSVGFile(svg)
    expect(result.width).toBe(100)
    expect(result.height).toBe(100)
    expect(result.paths).toHaveLength(1)
    expect(result.paths[0].vectorNetwork.vertices.length).toBeGreaterThan(0)
  })

  test('SVG with circle and rect', () => {
    const svg = '<svg viewBox="0 0 200 200"><circle cx="50" cy="50" r="30"/><rect x="100" y="100" width="50" height="50"/></svg>'
    const result = parseSVGFile(svg)
    expect(result.paths).toHaveLength(2)
  })

  test('SVG without viewBox uses width/height', () => {
    const svg = '<svg width="64" height="64"><path d="M0 0L64 64"/></svg>'
    const result = parseSVGFile(svg)
    expect(result.width).toBe(64)
    expect(result.height).toBe(64)
    expect(result.paths).toHaveLength(1)
  })

  test('SVG with no shapes returns empty paths', () => {
    const svg = '<svg viewBox="0 0 100 100"><text>Hello</text></svg>'
    const result = parseSVGFile(svg)
    expect(result.paths).toHaveLength(0)
    expect(result.width).toBe(100)
  })

  test('SVG with viewBox offset translates paths', () => {
    const svg = '<svg viewBox="10 10 80 80"><path d="M20 20L70 70"/></svg>'
    const result = parseSVGFile(svg)
    expect(result.paths).toHaveLength(1)
    const v = result.paths[0].vectorNetwork.vertices
    expect(v[0].x).toBe(10)
    expect(v[0].y).toBe(10)
  })

  test('parseSVGFile with targetSize scales paths', () => {
    const svg = '<svg viewBox="0 0 100 100"><path d="M0 0L100 100"/></svg>'
    const result = parseSVGFile(svg, 50)
    expect(result.width).toBe(50)
    expect(result.height).toBe(50)
    const v = result.paths[0].vectorNetwork.vertices
    expect(v[v.length - 1].x).toBe(50)
  })
})
