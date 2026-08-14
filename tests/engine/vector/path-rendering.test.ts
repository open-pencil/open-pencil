import { describe, expect, test } from 'bun:test'

import type { CanvasKit } from 'canvaskit-wasm'

import { vectorNetworkToPath } from '@open-pencil/core/vector'
import type { VectorNetwork } from '@open-pencil/scene-graph'

interface RecordedPath {
  operations: string[]
  fillType: number | null
}

function createCanvasKit() {
  const paths: RecordedPath[] = []
  class MockPath {
    operations: string[] = []
    fillType: number | null = null

    constructor() {
      paths.push(this)
    }

    moveTo(x: number, y: number): void {
      this.operations.push(`M${x},${y}`)
    }

    lineTo(x: number, y: number): void {
      this.operations.push(`L${x},${y}`)
    }

    cubicTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
      this.operations.push(`C${x1},${y1},${x2},${y2},${x3},${y3}`)
    }

    close(): void {
      this.operations.push('Z')
    }

    setFillType(value: number): void {
      this.fillType = value
    }
  }

  return {
    ck: {
      Path: MockPath,
      FillType: { Winding: 0, EvenOdd: 1 }
    } as CanvasKit,
    paths
  }
}

function mixedNetwork(): VectorNetwork {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 50, y: 50 },
      { x: 90, y: 50 }
    ],
    segments: [
      { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
      { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
      { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
      { start: 3, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
      { start: 4, end: 5, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
    ],
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
  }
}

describe('vectorNetworkToPath', () => {
  test('preserves open segments alongside filled regions', () => {
    const { ck, paths } = createCanvasKit()

    const result = vectorNetworkToPath(ck, mixedNetwork())

    expect(result).toHaveLength(2)
    expect(paths[0]).toEqual({
      operations: ['M0,0', 'L10,0', 'L10,10', 'L0,10', 'L0,0', 'Z'],
      fillType: 0
    })
    expect(paths[1]).toEqual({ operations: ['M50,50', 'L90,50'], fillType: null })
  })

  test('does not duplicate segments shared by multiple region loops', () => {
    const { ck, paths } = createCanvasKit()
    const network = mixedNetwork()
    network.regions.push({ windingRule: 'EVENODD', loops: [[0, 1, 2, 3]] })

    const result = vectorNetworkToPath(ck, network)

    expect(result).toHaveLength(3)
    expect(paths.filter((path) => path.operations.includes('M50,50'))).toHaveLength(1)
  })
})
