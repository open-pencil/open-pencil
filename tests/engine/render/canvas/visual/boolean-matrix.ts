import { writeFile } from 'node:fs/promises'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import { parseSVGPath } from '#core/io/formats/svg/parse-path'
import type { SceneNode } from '#core/scene-graph'

import { createAPI } from '#tests/engine/figma/api/helpers'
import { expectDefined } from '#tests/helpers/assert'

const CELL_W = 180
const CELL_H = 150
const COLUMNS = 4
const OUT = '/tmp/inkly-boolean-matrix.png'

type Operation = 'union' | 'subtract' | 'intersect' | 'exclude'
type CaseName = 'rect' | 'rounded' | 'ellipse' | 'arc' | 'line' | 'polygon' | 'star' | 'vector'

const cases: CaseName[] = ['rect', 'rounded', 'ellipse', 'arc', 'line', 'polygon', 'star', 'vector']
const operations: Operation[] = ['union', 'subtract', 'intersect', 'exclude']

function color(index: number) {
  const palette = [
    { r: 0.12, g: 0.45, b: 1, a: 1 },
    { r: 0.98, g: 0.22, b: 0.45, a: 1 },
    { r: 0.18, g: 0.74, b: 0.42, a: 1 },
    { r: 0.98, g: 0.64, b: 0.1, a: 1 }
  ]
  return palette[index % palette.length]
}

function setSolidFill(node: SceneNode, index: number) {
  node.fills = [{ type: 'SOLID', color: color(index), opacity: 1, visible: true }]
}

function makePair(name: CaseName, x: number, y: number) {
  const api = createAPI()
  const first = api.createRectangle()
  const second = api.createRectangle()

  first.x = x + 30
  first.y = y + 36
  second.x = x + 72
  second.y = y + 48
  first.resize(82, 72)
  second.resize(82, 72)

  const firstNode = expectDefined(api.graph.getNode(first.id), 'first node')
  const secondNode = expectDefined(api.graph.getNode(second.id), 'second node')

  if (name === 'rounded') {
    first.cornerRadius = 18
    second.cornerRadius = 18
  } else if (name === 'ellipse' || name === 'arc') {
    firstNode.type = 'ELLIPSE'
    secondNode.type = 'ELLIPSE'
    if (name === 'arc') {
      firstNode.arcData = { startingAngle: 0, endingAngle: Math.PI * 1.5, innerRadius: 0.35 }
      secondNode.arcData = {
        startingAngle: Math.PI * 0.25,
        endingAngle: Math.PI * 1.75,
        innerRadius: 0.2
      }
    }
  } else if (name === 'line') {
    firstNode.type = 'LINE'
    secondNode.type = 'LINE'
    firstNode.height = 54
    secondNode.height = 54
    firstNode.strokes = [
      { type: 'SOLID', color: color(1), opacity: 1, visible: true, weight: 14, align: 'CENTER' }
    ]
    secondNode.strokes = [
      { type: 'SOLID', color: color(2), opacity: 1, visible: true, weight: 14, align: 'CENTER' }
    ]
  } else if (name === 'polygon' || name === 'star') {
    firstNode.type = name === 'polygon' ? 'POLYGON' : 'STAR'
    secondNode.type = name === 'polygon' ? 'POLYGON' : 'STAR'
    firstNode.pointCount = name === 'polygon' ? 6 : 5
    secondNode.pointCount = name === 'polygon' ? 6 : 5
  } else if (name === 'vector') {
    firstNode.type = 'VECTOR'
    secondNode.type = 'VECTOR'
    firstNode.vectorNetwork = parseSVGPath('M 0 72 L 41 0 L 82 72 Z')
    secondNode.vectorNetwork = parseSVGPath('M 0 0 L 82 0 L 41 72 Z')
  }

  setSolidFill(firstNode, 0)
  setSolidFill(secondNode, 1)
  return { api, first, second }
}

function applyOperation(operation: Operation, pair: ReturnType<typeof makePair>) {
  switch (operation) {
    case 'union':
      return pair.api.union([pair.first, pair.second], pair.api.currentPage)
    case 'subtract':
      return pair.api.subtract([pair.first, pair.second], pair.api.currentPage)
    case 'intersect':
      return pair.api.intersect([pair.first, pair.second], pair.api.currentPage)
    case 'exclude':
      return pair.api.exclude([pair.first, pair.second], pair.api.currentPage)
  }
}

const ck = await initCanvasKit()
const width = CELL_W * COLUMNS
const rows = cases.length
const height = CELL_H * rows
const surface = expectDefined(ck.MakeSurface(width, height), 'surface')
const renderer = new SkiaRenderer(ck, surface)
renderer.viewportWidth = width
renderer.viewportHeight = height
renderer.dpr = 1
renderer.worldViewport = { x: -1e9, y: -1e9, w: 2e9, h: 2e9 }

const canvas = surface.getCanvas()
canvas.clear(ck.WHITE)

for (let row = 0; row < cases.length; row++) {
  for (let column = 0; column < operations.length; column++) {
    const pair = makePair(cases[row], column * CELL_W, row * CELL_H)
    const booleanNode = applyOperation(operations[column], pair)
    const node = expectDefined(pair.api.graph.getNode(booleanNode.id), 'boolean node')
    setSolidFill(node, column)
    renderer.renderNode(canvas, pair.api.graph, node.id, {})
  }
}

surface.flush()
const image = surface.makeImageSnapshot()
const png = expectDefined(image.encodeToBytes(ck.ImageFormat.PNG, 100), 'encoded image')
await writeFile(OUT, png)
image.delete()
surface.delete()

console.warn(OUT)
