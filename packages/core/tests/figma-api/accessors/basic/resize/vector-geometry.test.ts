import { expect, test } from 'bun:test'

import { uniqBy } from 'es-toolkit'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { createSVGNodes } from '@open-pencil/core/io/formats/svg'
import { SceneGraph } from '@open-pencil/scene-graph'

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="318" height="80" rx="12" fill="#558855"/></svg>'

const STROKED_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="314" height="76" fill="none" stroke="#000" stroke-width="4"/></svg>'

function importedVector(svg = SVG, graph = new SceneGraph()) {
  const root = createSVGNodes(graph, graph.getPages()[0].id, svg)
  if (!root) throw new Error('SVG import produced no nodes')
  const [node] = graph.getChildren(root.id)
  if (node?.type !== 'VECTOR') throw new Error('SVG rectangle did not import as a vector')
  const proxy = new FigmaAPI(graph).getNodeById(node.id)
  if (!proxy) throw new Error('Imported vector proxy was not found')
  return proxy
}

// Recorded in Figma 126: both methods squeeze the 12 px corners to 9.6 px tall.
const round = (value: number) => Math.round(value * 1000) / 1000

const RESIZED_VERTICES = [
  [12, 0],
  [306, 0],
  [318, 9.6],
  [318, 54.4],
  [306, 64],
  [12, 64],
  [0, 54.4],
  [0, 9.6]
]

for (const method of ['resize', 'resizeWithoutConstraints'] as const) {
  test(`${method} scales an imported vector's geometry with its box`, () => {
    // Regression for #1438: the SVG path must follow the new Plugin API dimensions.
    const vector = importedVector()

    vector[method](318, 64)

    const resizedNetwork = vector.vectorNetwork
    if (!resizedNetwork) throw new Error('Resized vector has no vector network')
    expect(vector.width).toBe(318)
    expect(vector.height).toBe(64)
    // Our SVG import keeps the closing point as its own vertex, which Figma merges.
    const vertices = uniqBy(
      resizedNetwork.vertices.map(({ x, y }) => [round(x), round(y)]),
      (point) => point.join(',')
    )
    expect(vertices).toEqual(RESIZED_VERTICES)
  })
}

// Figma 126: a 4 px stroke on a vector resized to half its height is still 4 px.
test('resize keeps the stroke weight and draws the stroke from the scaled path', () => {
  const graph = new SceneGraph()
  const vector = importedVector(STROKED_SVG, graph)
  graph.updateNode(vector.id, {
    strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: new Uint8Array([0]) }]
  })

  vector.resize(vector.width, vector.height / 2)

  expect(vector.strokeWeight).toBe(4)
  expect(graph.getNode(vector.id)?.strokeGeometry).toEqual([])
})

/** A path that moves to (x, y), enough for saved geometry to scale. */
function moveTo(x: number, y: number) {
  const commandsBlob = new Uint8Array(9)
  commandsBlob[0] = 1
  const view = new DataView(commandsBlob.buffer)
  view.setFloat32(1, x, true)
  view.setFloat32(5, y, true)
  return { windingRule: 'NONZERO' as const, commandsBlob }
}

test('a vector without a network keeps its saved stroke outline, scaled with the shape', () => {
  const graph = new SceneGraph()
  const vector = importedVector(STROKED_SVG, graph)
  graph.updateNode(vector.id, {
    vectorNetwork: null,
    fillGeometry: [moveTo(0, 76)],
    strokeGeometry: [moveTo(0, 76)]
  })

  vector.resize(vector.width, vector.height / 2)

  const node = graph.getNode(vector.id)
  expect(vector.strokeWeight).toBe(4)
  expect(node?.strokeGeometry).toHaveLength(1)
  const blob = node?.strokeGeometry[0]?.commandsBlob
  if (!blob) throw new Error('Resized vector lost its stroke outline')
  expect(new DataView(blob.buffer, blob.byteOffset).getFloat32(5, true)).toBeCloseTo(38)
})

// Recorded in Figma 126 for the same 318×80 rectangle.
test('a vector cannot be resized to 0×0', () => {
  const vector = importedVector()
  expect(() => vector.resize(0, 0)).toThrow('Cannot set width and height of vector node to zero')
  expect(() => vector.resizeWithoutConstraints(0, 0)).toThrow(
    'Cannot set width and height of vector node to zero'
  )
  expect(vector.width).toBe(318)
})

test('resize keeps a vector side above zero, so the shape comes back', () => {
  const vector = importedVector()
  vector.resize(0, 80)
  expect(vector.width).toBeCloseTo(0.0001, 6)

  vector.resize(318, 80)
  const corners = vector.vectorNetwork?.vertices.slice(0, 3).map(({ x, y }) => [round(x), round(y)])
  expect(corners).toEqual([
    [12, 0],
    [306, 0],
    [318, 12]
  ])
})

test('resizeWithoutConstraints to a zero side keeps the path, so the shape comes back', () => {
  const vector = importedVector()
  vector.resizeWithoutConstraints(0, 64)
  expect(vector.width).toBe(0)
  expect(vector.height).toBe(64)

  vector.resizeWithoutConstraints(318, 80)
  const corners = vector.vectorNetwork?.vertices.slice(0, 3).map(({ x, y }) => [round(x), round(y)])
  expect(corners).toEqual([
    [12, 0],
    [306, 0],
    [318, 12]
  ])
})
