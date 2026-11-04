import { describe, expect, test } from 'bun:test'

import type { PenNode } from '@open-pencil/pen'

import { getNodeOrThrow } from './helpers/assert'
import { parseDocument } from './helpers/document'

function paddingOf(padding: PenNode['padding']) {
  const node = getNodeOrThrow(
    parseDocument([
      { id: 'frame', type: 'frame', width: 200, height: 100, layout: 'vertical', padding }
    ]),
    'frame'
  )
  return [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]
}

describe('parsePenFile — padding', () => {
  test('reads one value for every side', () => {
    expect(paddingOf(8)).toEqual([8, 8, 8, 8])
  })

  test('reads two values as vertical and horizontal', () => {
    expect(paddingOf([4, 12])).toEqual([4, 12, 4, 12])
  })

  // pen.dev writes a bottom inset under a navigation title as [0, 0, 12, 0]; read as two values,
  // the bottom took the top's 0 and the title sat 12 pixels low.
  test('reads four values as top, right, bottom, and left', () => {
    expect(paddingOf([0, 0, 12, 0])).toEqual([0, 0, 12, 0])
    expect(paddingOf([1, 2, 3, 4])).toEqual([1, 2, 3, 4])
  })
})
