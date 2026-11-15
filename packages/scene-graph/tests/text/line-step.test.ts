import { expect, test } from 'bun:test'

import { estimatedLineStep, percentLength, pixelLength } from '@open-pencil/scene-graph/text'

// Where no font metrics measure a text (SVG export without a layout, outlines), lines step as the
// canvas steps them: a percent to whole pixels and a zero height by none (Figma desktop 126), and
// an automatic height at 1.2 times the font size.
test('lines step without font metrics as the canvas steps them', () => {
  expect(estimatedLineStep(percentLength(150), 13)).toBe(20)
  expect(estimatedLineStep(pixelLength(19.5), 13)).toBe(19.5)
  expect(estimatedLineStep(pixelLength(0), 13)).toBe(0)
  expect(estimatedLineStep(null, 20)).toBe(24)
})
