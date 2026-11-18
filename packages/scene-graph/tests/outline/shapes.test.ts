import { describe, expect, test } from 'bun:test'

import type { ArcData } from '@open-pencil/scene-graph'
import { isWholeEllipse } from '@open-pencil/scene-graph/outline'

const arc = (startingAngle: number, endingAngle: number, innerRadius = 0): ArcData => ({
  startingAngle,
  endingAngle,
  innerRadius
})

describe('whole ellipses', () => {
  test('an ellipse is whole without an arc, or with one that turns fully and has no hole', () => {
    expect(isWholeEllipse({ type: 'ELLIPSE', arcData: null })).toBe(true)
    expect(isWholeEllipse({ type: 'ELLIPSE', arcData: arc(0, Math.PI * 2) })).toBe(true)
    expect(isWholeEllipse({ type: 'ELLIPSE', arcData: arc(1, 1 + Math.PI * 2) })).toBe(true)
  })

  test('a part arc, a ring, or another layer type is not', () => {
    expect(isWholeEllipse({ type: 'ELLIPSE', arcData: arc(0, Math.PI) })).toBe(false)
    expect(isWholeEllipse({ type: 'ELLIPSE', arcData: arc(0, Math.PI * 2, 0.5) })).toBe(false)
    expect(isWholeEllipse({ type: 'RECTANGLE', arcData: null })).toBe(false)
  })
})
