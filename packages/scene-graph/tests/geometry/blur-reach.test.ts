import { expect, test } from 'bun:test'

import { blurReach, blurSigma, kernelReach } from '@open-pencil/scene-graph/geometry'

// Skia's Gaussian kernel ends at 3 sigma; one pixel more holds its rounding.
test('a blur reaches where its kernel ends, a pixel past 3 sigma', () => {
  expect(kernelReach(2)).toBe(7)
  expect(kernelReach(2.1)).toBe(8)
  expect(kernelReach(0)).toBe(0)
  expect(blurReach(10)).toBe(kernelReach(blurSigma(10)))
  expect(blurReach(-4)).toBe(0)
})
