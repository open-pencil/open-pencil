import { expect, test } from 'bun:test'

import { BLACK_STROKE, moveTo, paths, solid, svgOf } from './helpers'

// The canvas and hit testing draw an ellipse from the geometry Figma saved for it when there is
// some; the export follows, not the arc it would trace itself.
test('an arc exports the fill geometry saved for it, as the canvas draws it', () => {
  const svg = svgOf((graph, pageId) => [
    graph.createNode('ELLIPSE', pageId, {
      width: 10,
      height: 10,
      fills: [solid(1, 0, 0, 1, 1)],
      strokes: [BLACK_STROKE],
      arcData: { startingAngle: 0, endingAngle: Math.PI, innerRadius: 0 },
      fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: moveTo(3, 4) }]
    }).id
  ])
  expect(paths(svg).map((path) => path.match(/ d="([^"]*)"/)?.[1])).toEqual(['M3 4'])
})

// Figma's saved stroke geometry is the stroke's own outline, filled; the fill path then draws no
// stroke of its own, or translucent and dashed borders would be painted twice.
test('a saved stroke geometry draws the stroke once', () => {
  const svg = svgOf((graph, pageId) => [
    graph.createNode('ELLIPSE', pageId, {
      width: 10,
      height: 10,
      fills: [solid(1, 0, 0, 1, 1)],
      strokes: [BLACK_STROKE],
      fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: moveTo(3, 4) }],
      strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: moveTo(5, 6) }]
    }).id
  ])
  expect(paths(svg).filter((path) => / stroke="#/.test(path))).toEqual([])
})
