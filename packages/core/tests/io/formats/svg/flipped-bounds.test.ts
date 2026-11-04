import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { flippedCases } from '#core-tests/helpers/flipped-layers'

import { SceneGraph } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'

import { computeContentBounds } from '#core/io/formats/raster'
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

function elementMatrix(svg: string, matches: (name: string, attrs: string) => boolean): Mat3 {
  const stack: Mat3[] = [Matrix.identity()]
  for (const [, closing, name, attrs, selfClosing] of svg.matchAll(/<(\/?)(\w+)([^>]*?)(\/?)>/g)) {
    if (closing) {
      stack.pop()
      continue
    }
    const parent = expectDefined(stack.at(-1))
    const matrix = Matrix.multiply(parent, transformMatrix(attrs.match(/transform="([^"]*)"/)?.[1]))
    if (matches(name, attrs)) {
      return matrix
    }
    if (!selfClosing) {
      stack.push(matrix)
    }
  }
  throw new Error('No matching element in the SVG')
}

function redRectMatrix(svg: string): Mat3 {
  return elementMatrix(svg, (name, attrs) => name === 'rect' && attrs.includes('fill="#FF0000"'))
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

  test('a rotated line turns about its start, as the canvas draws it', () => {
    const graph = new SceneGraph()
    const pageId = expectDefined(graph.getPages()[0]).id
    const line = graph.createNode('LINE', pageId, {
      x: 40,
      y: 30,
      width: 80,
      height: 0,
      rotation: 30,
      strokes: [
        {
          type: 'SOLID',
          weight: 2,
          visible: true,
          align: 'CENTER',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1
        }
      ]
    })
    const svg = expectDefined(renderNodesToSVG(graph, pageId, [line.id]))
    const bounds = expectDefined(computeContentBounds(graph, [line.id]))
    const expected = Matrix.multiply(
      Matrix.translated(-bounds.minX, -bounds.minY),
      getWorldMatrix(line, graph)
    )
    const actual = elementMatrix(
      svg,
      (name, attrs) => name === 'line' && attrs.includes('stroke="#FF0000"')
    )
    for (const index of [0, 1, 2, 3, 4, 5]) {
      expect(actual[index]).toBeCloseTo(expected[index], 1)
    }
  })
})
