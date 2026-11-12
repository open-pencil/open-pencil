import { describe, expect, test } from 'bun:test'

import type { Fill } from '@open-pencil/scene-graph'

import { BLACK_STROKE, moveTo, paths, rects, solid, svgOf } from './helpers'

describe('a stroke over fills SVG cannot all draw', () => {
  const stroke = BLACK_STROKE
  // Noise has no SVG paint, so it is left out; the stroke goes on the fill drawn last.
  const noise: Fill = {
    type: 'NOISE',
    color: { r: 1, g: 1, b: 1, a: 1 },
    opacity: 1,
    visible: true
  }

  test('goes on the last fill a shape draws', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('RECTANGLE', pageId, {
        width: 10,
        height: 10,
        fills: [solid(1, 0, 0, 1, 1), solid(0, 0, 1, 1, 1), noise],
        strokes: [stroke]
      }).id
    ])
    expect(rects(svg)).toHaveLength(2)
    expect(rects(svg)[0]).not.toContain('stroke=')
    expect(rects(svg)[1]).toContain('fill="#0000FF"')
    expect(rects(svg)[1]).toContain('stroke="#000000"')
  })

  test('draws alone on a shape with no fill SVG draws', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('RECTANGLE', pageId, {
        width: 10,
        height: 10,
        fills: [noise, noise],
        strokes: [stroke]
      }).id
    ])
    expect(rects(svg)).toHaveLength(1)
    expect(rects(svg)[0]).toContain('stroke="#000000"')
  })

  test('goes on the last paint a vector region draws', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('VECTOR', pageId, {
        width: 10,
        height: 10,
        strokes: [stroke],
        vectorNetwork: {
          vertices: [],
          segments: [],
          regions: [{ windingRule: 'NONZERO', loops: [], fills: [solid(0, 0, 1, 1, 1), noise] }]
        },
        fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: moveTo(0, 0) }]
      }).id
    ])
    expect(paths(svg)).toEqual([
      '<path d="M0 0" fill="#0000FF" stroke="#000000" stroke-width="2"/>'
    ])
  })
})

describe('a vector with several filled regions exported to SVG', () => {
  const stroke = BLACK_STROKE

  // The canvas strokes after every fill, so a later region's fill cannot cover an earlier stroke.
  test('draws the strokes after every region fill', () => {
    const svg = svgOf((graph, pageId) => [
      graph.createNode('VECTOR', pageId, {
        width: 10,
        height: 10,
        strokes: [stroke],
        vectorNetwork: {
          vertices: [],
          segments: [],
          regions: [
            { windingRule: 'NONZERO', loops: [], fills: [solid(1, 0, 0, 1, 1)] },
            { windingRule: 'NONZERO', loops: [], fills: [solid(0, 0, 1, 1, 1)] }
          ]
        },
        fillGeometry: [
          { windingRule: 'NONZERO', commandsBlob: moveTo(0, 0) },
          { windingRule: 'NONZERO', commandsBlob: moveTo(10, 0) }
        ]
      }).id
    ])
    expect(paths(svg)).toEqual([
      '<path d="M0 0" fill="#FF0000" stroke="none" stroke-width="2"/>',
      '<path d="M10 0" fill="#0000FF" stroke="none" stroke-width="2"/>',
      '<path d="M0 0" fill="none" stroke="#000000" stroke-width="2"/>',
      '<path d="M10 0" fill="none" stroke="#000000" stroke-width="2"/>'
    ])
  })
})
