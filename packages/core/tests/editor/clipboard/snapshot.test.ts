import { describe, expect, test } from 'bun:test'

import {
  REGION_POSTER,
  STROKE_IMAGE,
  vectorWithStrokeAndRegionImages
} from '#core-tests/helpers/clipboard'

import { captureClipboardSnapshot } from '#core/editor/clipboard/snapshot'

describe('clipboard snapshot', () => {
  test('carries the images a stroke and a vector region draw', () => {
    const { graph, vector } = vectorWithStrokeAndRegionImages()

    const snapshot = captureClipboardSnapshot(graph, [vector])

    expect([...snapshot.images.keys()].sort()).toEqual([REGION_POSTER, STROKE_IMAGE])
  })
})
