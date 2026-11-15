import { describe, expect, test } from 'bun:test'

import { setup, stroke } from '../helpers/outline'

describe('independent borders', () => {
  test('each side of a rectangle with independent borders reaches by its own weight', () => {
    const { add, hits } = setup()
    const box = add('RECTANGLE', {
      width: 200,
      height: 150,
      strokes: [stroke(1, 'INSIDE')],
      independentStrokeWeights: true,
      borderTopWeight: 20,
      borderRightWeight: 1,
      borderBottomWeight: 1,
      borderLeftWeight: 1
    })
    // 15 units in from the thick top border is on it; 15 in from the thin left one is not.
    expect(hits(box, 100, 15)).toBe(true)
    expect(hits(box, 15, 75)).toBe(false)
  })

  test('independent borders follow rounded corners', () => {
    const { add, hits } = setup()
    const box = add('RECTANGLE', {
      width: 100,
      height: 100,
      cornerRadius: 50,
      strokes: [stroke(1, 'INSIDE')],
      independentStrokeWeights: true,
      borderTopWeight: 10,
      borderRightWeight: 1,
      borderBottomWeight: 1,
      borderLeftWeight: 1
    })
    // 5 units in from the rounded corner lies on the 10-unit top border drawn round it.
    expect(hits(box, 18.2, 18.2)).toBe(true)
    // The square corner outside the curve is empty.
    expect(hits(box, 1, 1)).toBe(false)
  })

  test('a side with no border weight takes no clicks', () => {
    const { add, hits } = setup()
    const box = add('RECTANGLE', {
      width: 200,
      height: 150,
      strokes: [stroke(1, 'INSIDE')],
      independentStrokeWeights: true,
      borderTopWeight: 4,
      borderRightWeight: 0,
      borderBottomWeight: 4,
      borderLeftWeight: 4
    })
    expect(hits(box, 199, 75)).toBe(false)
    expect(hits(box, 1, 75)).toBe(true)
  })
})
