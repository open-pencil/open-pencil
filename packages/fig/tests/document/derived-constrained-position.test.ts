import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { Vector } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { ConstraintType } from '@open-pencil/scene-graph'

const guid = (localID: number) => ({ sessionID: 1, localID })
const at = (x: number, y: number) => ({ m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y })

function fullSizeLayerInResizedInstance(
  horizontal: ConstraintType,
  instance: Vector,
  saved: Pick<NodeChange, 'size' | 'transform'> | null
): NodeChange[] {
  return [
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    {
      guid: guid(2),
      type: 'SYMBOL',
      size: { x: 1920, y: 1080 },
      parentIndex: { guid: guid(1), position: '!' }
    },
    {
      guid: guid(3),
      type: 'FRAME',
      size: { x: 1920, y: 1080 },
      transform: at(0, 0),
      horizontalConstraint: 'SCALE',
      verticalConstraint: 'SCALE',
      parentIndex: { guid: guid(2), position: '!' }
    },
    {
      guid: guid(4),
      type: 'ROUNDED_RECTANGLE',
      size: { x: 1920, y: 1080 },
      transform: at(0, 0),
      horizontalConstraint: horizontal,
      verticalConstraint: 'SCALE',
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
            { guidPath: { guids: [guid(3)] }, size: instance },
            { guidPath: { guids: [guid(3), guid(4)] }, ...saved }
          ]
        : undefined
    }
  ]
}

function placedLayer(changes: NodeChange[]) {
  const { graph, sources } = materializeDocument(changes, [], { derivedBounds: true })
  const instance = sources.get('1:6')
  if (!instance) {
    throw new Error('Missing instance')
  }
  const [frame] = graph.getChildren(instance)
  const [layer] = graph.getChildren(frame.id)
  return { x: layer.x, y: layer.y, width: layer.width, height: layer.height }
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
    test(`a saved size without a transform keeps the layer's own position (${horizontal}, ${instance.x})`, () => {
      const changes = fullSizeLayerInResizedInstance(horizontal, instance, { size: instance })
      expect(placedLayer(changes)).toEqual({ x: 0, y: 0, width: instance.x, height: instance.y })
    })
  }
}

test('a saved transform still places the layer', () => {
  const instance = { x: 2560, y: 1440 }
  const size = { x: 2400, y: 1440 }
  const changes = fullSizeLayerInResizedInstance('CENTER', instance, {
    size,
    transform: at(80, 0)
  })
  expect(placedLayer(changes)).toEqual({ x: 80, y: 0, width: 2400, height: 1440 })
})

test('without saved bounds the constraint places the layer', () => {
  const changes = fullSizeLayerInResizedInstance('CENTER', { x: 2560, y: 1440 }, null)
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
