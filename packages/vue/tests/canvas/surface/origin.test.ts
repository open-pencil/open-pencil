import { describe, expect, test } from 'bun:test'

import type { Vector } from '@open-pencil/scene-graph/primitives'

import { createCanvasOriginTracker } from '#vue/canvas/surface/origin'

const PANELS_SHOWN: Vector = { x: 230, y: 48 }
const PANELS_HIDDEN: Vector = { x: 0, y: 0 }

function recordedTracker() {
  const moves: Vector[] = []
  const tracker = createCanvasOriginTracker((dx, dy) => moves.push({ x: dx, y: dy }))
  return { moves, tracker }
}

describe('canvas origin tracker', () => {
  test('reports each move of the canvas both ways', () => {
    const { moves, tracker } = recordedTracker()
    tracker.place(PANELS_SHOWN)
    tracker.place(PANELS_HIDDEN)
    tracker.place(PANELS_SHOWN)

    expect(moves).toEqual([
      { x: -230, y: -48 },
      { x: 230, y: 48 }
    ])
  })

  test('reports nothing when the canvas only grows or shrinks', () => {
    const { moves, tracker } = recordedTracker()
    tracker.place(PANELS_SHOWN)
    tracker.place({ ...PANELS_SHOWN })

    expect(moves).toEqual([])
  })

  test('takes the first placement as where the canvas starts', () => {
    const { moves, tracker } = recordedTracker()
    tracker.place(PANELS_SHOWN)

    expect(moves).toEqual([])
  })

  test('does nothing for a host that did not ask for moves', () => {
    const tracker = createCanvasOriginTracker(undefined)

    expect(() => {
      tracker.place(PANELS_SHOWN)
      tracker.place(PANELS_HIDDEN)
    }).not.toThrow()
  })
})
