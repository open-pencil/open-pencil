import { describe, expect, test } from 'bun:test'

import type { VectorSegment, VectorVertex } from '@open-pencil/scene-graph'

import { addStrokeRunToPath, strokeRuns, type PathSink } from '#core/vector/path-helpers'

const zero = { x: 0, y: 0 }

function line(start: number, end: number): VectorSegment {
  return { start, end, tangentStart: zero, tangentEnd: zero }
}

/** Records path commands as strings. */
function recorder(): PathSink & { commands: string[] } {
  const commands: string[] = []
  return {
    commands,
    moveTo: (x, y) => commands.push(`M${x},${y}`),
    lineTo: (x, y) => commands.push(`L${x},${y}`),
    cubicTo: (_x1, _y1, _x2, _y2, x, y) => commands.push(`C${x},${y}`),
    close: () => commands.push('Z')
  }
}

function draw(segments: VectorSegment[], vertices: VectorVertex[]) {
  return strokeRuns(segments).map((run) => {
    const path = recorder()
    addStrokeRunToPath(path, run, segments, vertices)
    return path.commands.join(' ')
  })
}

describe('stroke runs', () => {
  test('an open polyline strokes as one contour, so its corners join', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ]
    expect(draw([line(0, 1), line(1, 2)], vertices)).toEqual(['M0,0 L10,0 L10,10'])
  })

  test('segments stored out of order and against the drawing direction still chain', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]
    // The middle segment comes first and runs backwards; the run starts at an open end.
    const runs = draw([line(2, 1), line(0, 1), line(2, 3)], vertices)
    expect(runs).toHaveLength(1)
    expect(['M0,0 L10,0 L10,10 L0,10', 'M0,10 L10,10 L10,0 L0,0']).toContain(runs[0])
  })

  test('a loop closes, so its first corner joins too', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ]
    expect(draw([line(0, 1), line(1, 2), line(2, 0)], vertices)).toEqual([
      'M0,0 L10,0 L10,10 L0,0 Z'
    ])
  })

  test('a junction of three segments ends the runs that meet there', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: -10, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 }
    ]
    const runs = strokeRuns([line(0, 1), line(0, 2), line(0, 3)])
    expect(runs.map((run) => run.segments)).toEqual([[0], [1], [2]])
    expect(runs.every((run) => !run.closed)).toBe(true)
    expect(draw([line(0, 1), line(0, 2), line(0, 3)], vertices)).toHaveLength(3)
  })

  test('a loop through a junction closes whichever of its segments is stored first', () => {
    // A square with a tail from its top-left corner, the junction.
    const square = [line(0, 1), line(1, 2), line(2, 3), line(3, 0)]
    const tail = line(0, 4)
    for (const segments of [
      [...square, tail],
      [square[1], square[2], square[3], square[0], tail]
    ]) {
      const loop = strokeRuns(segments).find((run) => run.segments.length === 4)
      expect(loop?.closed).toBe(true)
    }
  })

  test('a curve drawn backwards swaps its handles', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 }
    ]
    const curve = { start: 2, end: 1, tangentStart: { x: 0, y: 5 }, tangentEnd: { x: 0, y: -5 } }
    const path = recorder()
    const cubic: number[][] = []
    path.cubicTo = (...args) => cubic.push(args)
    for (const run of strokeRuns([line(0, 1), curve]))
      addStrokeRunToPath(path, run, [line(0, 1), curve], vertices)
    // Drawn from vertex 1 to 2: the first handle hangs off vertex 1 by tangentEnd.
    expect(cubic).toEqual([[10, -5, 20, 5, 20, 0]])
  })
})
