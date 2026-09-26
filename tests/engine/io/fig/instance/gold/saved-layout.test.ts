import { expect, test } from 'bun:test'

import { interpretInstance, resolveOccurrencePath } from '#fig/instance-overrides/interpret'

import { parseFigBuffer } from '@open-pencil/fig'
import { nodeChangeToProps, stringToGuid } from '@open-pencil/fig/node-change'

import { readFixtureArrayBuffer } from '#tests/helpers/fig/fixtures'

import oracle from '../fixtures/gold-input-layout.json'

test('Gold saved input geometry matches the independent Figma capture before layout', async () => {
  const { nodeChanges, blobs } = parseFigBuffer(readFixtureArrayBuffer('gold-preview.fig'))
  const input = interpretInstance(nodeChanges, '1:3503', { derivedBounds: true })
  for (const expected of oracle.nodes) {
    const path = expected.id.split(';').slice(1).map(stringToGuid)
    const occurrence = resolveOccurrencePath(input, path)
    const props = nodeChangeToProps(occurrence.properties, blobs)
    for (const field of ['x', 'y', 'width', 'height'] as const) {
      expect(props[field], `${expected.id}.${field}`).toBeCloseTo(expected[field], 4)
    }
  }
  // Runtime padding/spacing and post-layout geometry are not accepted by this test.
  // The capture's effective metrics remain the oracle for that pending fix.
})
