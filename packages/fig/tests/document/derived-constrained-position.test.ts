import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { Matrix, Vector } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { ConstraintType, SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'

const guid = (localID: number) => ({ sessionID: 1, localID })
const at = (x: number, y: number) => ({ m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y })
const lineTurnedAlongXAt = (x: number, y: number) => ({
  m00: 0,
  m01: 1,
  m02: x,
  m10: -1,
  m11: 0,
  m12: y
})

const SYMBOL_SIZE = { x: 1920, y: 1080 }
const FULL_SIZE_LAYER = { size: SYMBOL_SIZE, transform: at(0, 0) }

interface ResizedInstance {
  horizontal: ConstraintType
  vertical?: ConstraintType
  instance: Vector
  saved: Pick<NodeChange, 'size' | 'transform'> | null
  layer?: { size: Vector; transform: Matrix }
  frame?: Pick<NodeChange, 'stackMode'>
}

function layerInResizedInstance({
  horizontal,
  vertical = 'SCALE',
  instance,
  saved,
  layer = FULL_SIZE_LAYER,
  frame = {}
}: ResizedInstance): NodeChange[] {
  return [
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    {
      guid: guid(2),
      type: 'SYMBOL',
      size: SYMBOL_SIZE,
      parentIndex: { guid: guid(1), position: '!' }
    },
    {
      guid: guid(3),
      type: 'FRAME',
      size: SYMBOL_SIZE,
      transform: at(0, 0),
      horizontalConstraint: 'SCALE',
      verticalConstraint: 'SCALE',
      parentIndex: { guid: guid(2), position: '!' },
      ...frame
    },
    {
      guid: guid(4),
      type: 'ROUNDED_RECTANGLE',
      size: layer.size,
      transform: layer.transform,
      horizontalConstraint: horizontal,
      verticalConstraint: vertical,
      parentIndex: { guid: guid(3), position: '!' }
    },
    { guid: guid(5), type: 'FRAME', parentIndex: { guid: guid(1), position: '"' } },
    {
      guid: guid(6),
      type: 'INSTANCE',
      size: instance,
      transform: at(0, 0),
      parentIndex: { guid: guid(5), position: '!' },
      symbolData: { symbolID: guid(2) },
      derivedSymbolData: saved
        ? [
            { guidPath: { guids: [guid(3), guid(4)] }, ...saved },
            { guidPath: { guids: [guid(3)] }, size: instance }
          ]
        : undefined
    }
  ]
}

function materializedLayer(changes: NodeChange[]): SceneNode {
  const { graph, sources } = materializeDocument(changes, [], { derivedBounds: true })
  const instance = sources.get('1:6')
  if (!instance) {
    throw new Error('Missing instance')
  }
  const [frame] = graph.getChildren(instance)
  const [layer] = graph.getChildren(frame.id)
  return layer
}

function placedLayer(changes: NodeChange[]) {
  const layer = materializedLayer(changes)
  return { x: layer.x, y: layer.y, width: layer.width, height: layer.height }
}

function turnedLayer(changes: NodeChange[]) {
  const layer = materializedLayer(changes)
  const [, , originX, , , originY] = getNodeLocalMatrix(layer)
  return {
    origin: { x: Math.round(originX), y: Math.round(originY) },
    rotation: layer.rotation,
    width: layer.width,
    height: layer.height
  }
}

const RESIZES = [
  { x: 1600, y: 900 },
  { x: 1920, y: 1080 },
  { x: 2560, y: 1440 },
  { x: 3840, y: 2160 }
]
const CONSTRAINTS: ConstraintType[] = ['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']

for (const horizontal of CONSTRAINTS) {
  for (const instance of RESIZES) {
    test(`a saved size without a transform keeps a full size layer at the origin (${horizontal}, ${instance.x})`, () => {
      const changes = layerInResizedInstance({ horizontal, instance, saved: { size: instance } })
      expect(placedLayer(changes)).toEqual({ x: 0, y: 0, width: instance.x, height: instance.y })
    })

    test(`a saved size without a transform keeps a turned bottom line on the bottom edge (${horizontal}, ${instance.x})`, () => {
      const changes = layerInResizedInstance({
        horizontal,
        vertical: 'MAX',
        instance,
        saved: { size: { x: 1, y: instance.x } },
        layer: { size: { x: 1, y: SYMBOL_SIZE.x }, transform: lineTurnedAlongXAt(0, SYMBOL_SIZE.y) }
      })
      expect(turnedLayer(changes)).toEqual({
        origin: { x: 0, y: instance.y },
        rotation: -90,
        width: 1,
        height: instance.x
      })
    })
  }
}

test('a saved size without a transform keeps a bottom pinned layer on the bottom edge', () => {
  const instance = { x: 2560, y: 1000 }
  const changes = layerInResizedInstance({
    horizontal: 'STRETCH',
    vertical: 'MAX',
    instance,
    saved: { size: { x: 2560, y: 1 } },
    layer: { size: { x: 1920, y: 1 }, transform: at(0, 1079) }
  })
  expect(placedLayer(changes)).toEqual({ x: 0, y: 999, width: 2560, height: 1 })
})

test('a saved size without a transform keeps a centered layer centered at that size', () => {
  const changes = layerInResizedInstance({
    horizontal: 'CENTER',
    instance: { x: 2560, y: 1440 },
    saved: { size: { x: 600, y: 1440 } },
    layer: { size: { x: 400, y: 1080 }, transform: at(760, 0) }
  })
  expect(placedLayer(changes)).toEqual({ x: 980, y: 0, width: 600, height: 1440 })
})

test('a saved size without a transform keeps an auto layout child where the symbol put it', () => {
  const changes = layerInResizedInstance({
    horizontal: 'CENTER',
    instance: { x: 3840, y: 2160 },
    saved: { size: { x: 3000, y: 2160 } },
    layer: { size: { x: 1840, y: 1080 }, transform: at(40, 0) },
    frame: { stackMode: 'HORIZONTAL' }
  })
  expect(placedLayer(changes)).toEqual({ x: 40, y: 0, width: 3000, height: 2160 })
})

test('a saved size without a transform keeps the layer of an instance at its symbol size', () => {
  const changes = layerInResizedInstance({
    horizontal: 'CENTER',
    instance: SYMBOL_SIZE,
    saved: { size: { x: 1800, y: 1080 } },
    layer: { size: { x: 1720, y: 1080 }, transform: at(100, 0) }
  })
  expect(placedLayer(changes)).toEqual({ x: 100, y: 0, width: 1800, height: 1080 })
})

test('a later saved transform for the same layer wins over its size-only record', () => {
  const instance = { x: 2560, y: 1440 }
  const layerPath = { guids: [guid(3), guid(4)] }
  const changes = layerInResizedInstance({ horizontal: 'CENTER', instance, saved: null })
  const instanceRecord = changes[changes.length - 1]
  instanceRecord.derivedSymbolData = [
    { guidPath: { guids: [guid(3)] }, size: instance },
    { guidPath: layerPath, size: { x: 2400, y: 1440 } },
    { guidPath: layerPath, transform: at(7, 0) }
  ]
  expect(placedLayer(changes)).toEqual({ x: 7, y: 0, width: 2400, height: 1440 })
})

test('a saved transform still places the layer', () => {
  const changes = layerInResizedInstance({
    horizontal: 'CENTER',
    instance: { x: 2560, y: 1440 },
    saved: { size: { x: 2400, y: 1440 }, transform: at(80, 0) }
  })
  expect(placedLayer(changes)).toEqual({ x: 80, y: 0, width: 2400, height: 1440 })
})

test('without saved bounds the constraint places the layer', () => {
  const changes = layerInResizedInstance({
    horizontal: 'CENTER',
    instance: { x: 2560, y: 1440 },
    saved: null
  })
  expect(placedLayer(changes)).toEqual({ x: 320, y: 0, width: 1920, height: 1440 })
})
test('a saved size without a transform keeps the position through nested resized instances', () => {
  const inner = { x: 2560, y: 1440 }
  const outer = { x: 3840, y: 2160 }
  const changes: NodeChange[] = [
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    {
      guid: guid(2),
      type: 'SYMBOL',
      size: { x: 1920, y: 1080 },
      parentIndex: { guid: guid(1), position: '!' }
    },
    {
      guid: guid(4),
      type: 'ROUNDED_RECTANGLE',
      size: { x: 1920, y: 1080 },
      transform: at(0, 0),
      horizontalConstraint: 'CENTER',
      verticalConstraint: 'CENTER',
      parentIndex: { guid: guid(2), position: '!' }
    },
    { guid: guid(10), type: 'SYMBOL', size: inner, parentIndex: { guid: guid(1), position: '"' } },
    {
      guid: guid(11),
      type: 'INSTANCE',
      size: inner,
      transform: at(0, 0),
      horizontalConstraint: 'SCALE',
      verticalConstraint: 'SCALE',
      parentIndex: { guid: guid(10), position: '!' },
      symbolData: { symbolID: guid(2) },
      derivedSymbolData: [{ guidPath: { guids: [guid(4)] }, size: inner }]
    },
    { guid: guid(5), type: 'FRAME', parentIndex: { guid: guid(1), position: '#' } },
    {
      guid: guid(6),
      type: 'INSTANCE',
      size: outer,
      transform: at(0, 0),
      parentIndex: { guid: guid(5), position: '!' },
      symbolData: { symbolID: guid(10) },
      derivedSymbolData: [
        { guidPath: { guids: [guid(11)] }, size: outer },
        { guidPath: { guids: [guid(11), guid(4)] }, size: outer }
      ]
    }
  ]
  expect(placedLayer(changes)).toEqual({ x: 0, y: 0, width: outer.x, height: outer.y })
})
