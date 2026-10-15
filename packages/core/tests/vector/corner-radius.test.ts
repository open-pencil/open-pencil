import { describe, expect, test } from 'bun:test'

import type { VectorSegment, VectorVertex } from '@open-pencil/scene-graph'

import { addOpenSegmentsToPath, type PathSink } from '#core/vector/path-helpers'

const zero = { x: 0, y: 0 }

function line(start: number, end: number): VectorSegment {
  return { start, end, tangentStart: zero, tangentEnd: zero }
}

/** Records path commands, with a cubic's handles rounded to a tenth. */
function recorder(): PathSink & { commands: string[] } {
  const commands: string[] = []
  const r = (value: number) => Math.round(value * 10) / 10
  return {
    commands,
    moveTo: (x, y) => commands.push(`M${r(x)},${r(y)}`),
    lineTo: (x, y) => commands.push(`L${r(x)},${r(y)}`),
    cubicTo: (x1, y1, x2, y2, x, y) =>
      commands.push(`C${r(x1)},${r(y1)} ${r(x2)},${r(y2)} ${r(x)},${r(y)}`),
    close: () => commands.push('Z')
  }
}

const elbow: VectorVertex[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 }
]

function draw(vertices: VectorVertex[], cornerRadius: number) {
  const path = recorder()
  addOpenSegmentsToPath(path, [line(0, 1), line(1, 2)], vertices, cornerRadius)
  return path.commands
}

// Figma rounds a vector's corners by its corner radius, as a connector's elbows show.
describe('vector corner radius', () => {
  test('rounds a right-angle corner with a quarter circle of the radius', () => {
    expect(draw(elbow, 24)).toEqual(['M0,0', 'L76,0', 'C89.3,0 100,10.7 100,24', 'L100,100'])
  })

  test('leaves corners sharp without a radius', () => {
    expect(draw(elbow, 0)).toEqual(['M0,0', 'L100,0', 'L100,100'])
  })

  test('takes no more than half of a short segment', () => {
    const short: VectorVertex[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 100 }
    ]
    expect(draw(short, 24).slice(0, 2)).toEqual(['M0,0', 'L10,0'])
  })

  test("a vertex's own radius wins over the vector's", () => {
    const own: VectorVertex[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0, cornerRadius: 8 },
      { x: 100, y: 100 }
    ]
    expect(draw(own, 24)[1]).toBe('L92,0')
  })

  test('rounds every corner of a closed outline, the one it starts at too, and closes it', () => {
    const square: VectorVertex[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]
    const path = recorder()
    addOpenSegmentsToPath(path, [line(0, 1), line(1, 2), line(2, 3), line(3, 0)], square, 10)
    expect(path.commands).toEqual([
      'M10,0',
      'L90,0',
      'C95.5,0 100,4.5 100,10',
      'L100,90',
      'C100,95.5 95.5,100 90,100',
      'L10,100',
      'C4.5,100 0,95.5 0,90',
      'L0,10',
      'C0,4.5 4.5,0 10,0',
      'Z'
    ])
  })

  test('leaves a corner next to a curve sharp', () => {
    const path = recorder()
    const curve = { start: 1, end: 2, tangentStart: { x: 0, y: 40 }, tangentEnd: { x: 0, y: -40 } }
    addOpenSegmentsToPath(path, [line(0, 1), curve], elbow, 24)
    expect(path.commands.slice(0, 2)).toEqual(['M0,0', 'L100,0'])
  })

  test('leaves coincident and straight-through vertices as they are', () => {
    const coincident: VectorVertex[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0 }
    ]
    expect(draw(coincident, 24)).toEqual(['M0,0', 'L100,0', 'L100,0'])
    const straight: VectorVertex[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 }
    ]
    expect(draw(straight, 24)).toEqual(['M0,0', 'L100,0', 'L200,0'])
  })
})
