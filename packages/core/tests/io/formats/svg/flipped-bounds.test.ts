import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { flippedCases } from '#core-tests/helpers/flipped-layers'

import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'

import { renderNodesToSVG } from '#core/io/formats/svg'

function transformMatrix(transform: string | undefined): Mat3 {
  let matrix = Matrix.identity()
  for (const [, name, args] of (transform ?? '').matchAll(/(\w+)\(([^)]*)\)/g)) {
    const [a = 0, b = 0, c = 0] = args.split(/[\s,]+/).map(Number)
    if (name === 'translate') {
      matrix = Matrix.multiply(matrix, Matrix.translated(a, b))
    } else if (name === 'rotate') {
      matrix = Matrix.multiply(matrix, Matrix.rotated((a * Math.PI) / 180, b, c))
    } else if (name === 'scale') {
      matrix = Matrix.multiply(matrix, Matrix.scaled(a, b))
    } else {
      throw new Error(`Unexpected transform ${name}`)
    }
  }
  return matrix
}

function redRectMatrix(svg: string): Mat3 {
  const stack: Mat3[] = [Matrix.identity()]
  for (const [, closing, name, attrs, selfClosing] of svg.matchAll(/<(\/?)(\w+)([^>]*?)(\/?)>/g)) {
    if (closing) {
      stack.pop()
      continue
    }
    const parent = expectDefined(stack.at(-1))
    const matrix = Matrix.multiply(parent, transformMatrix(attrs.match(/transform="([^"]*)"/)?.[1]))
    if (name === 'rect' && attrs.includes('fill="#FF0000"')) {
      return matrix
    }
    if (!selfClosing) {
      stack.push(matrix)
    }
  }
  throw new Error('No red rectangle in the SVG')
}

function viewBox(svg: string) {
  const [, width, height] = expectDefined(svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/), 'viewBox')
  return { width: Number(width), height: Number(height) }
}

describe('SVG export of flipped layers', () => {
  for (const layer of flippedCases()) {
    test(`${layer.name} is sized to everything it covers`, () => {
      const svg = expectDefined(renderNodesToSVG(layer.graph, layer.pageId, [layer.nodeId]))
      const box = viewBox(svg)
      expect(box.width).toBeCloseTo(layer.bounds.maxX - layer.bounds.minX, 2)
      expect(box.height).toBeCloseTo(layer.bounds.maxY - layer.bounds.minY, 2)
    })

    test(`${layer.name} is drawn where its world matrix puts it`, () => {
      const svg = expectDefined(renderNodesToSVG(layer.graph, layer.pageId, [layer.nodeId]))
      const ink = expectDefined(layer.graph.getNode(layer.inkId))
      const expected = Matrix.multiply(
        Matrix.translated(-layer.bounds.minX, -layer.bounds.minY),
        getWorldMatrix(ink, layer.graph)
      )
      const actual = redRectMatrix(svg)
      for (const index of [0, 1, 2, 3, 4, 5]) {
        expect(actual[index]).toBeCloseTo(expected[index], 1)
      }
    })
  }
})
