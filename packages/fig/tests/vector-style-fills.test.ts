import { describe, expect, test } from 'bun:test'

import type { Paint } from '@open-pencil/kiwi/fig/codec'
import type { Fill } from '@open-pencil/scene-graph'
import { SceneGraph } from '@open-pencil/scene-graph'
import { scaleGeometryPaths } from '@open-pencil/scene-graph/copy'

import { resolveDsdGeometry } from '../src/instance-overrides/derived-symbol-data/geometry'
import {
  resolveGeometryPaths,
  resolveStyleOverrideFills,
  sceneNodeToKiwi,
  type StyleOverride
} from '../src/node-change'

function solidFill(r: number, g: number, b: number): Fill {
  return {
    type: 'SOLID',
    color: { r, g, b, a: 1 },
    opacity: 1,
    visible: true,
    blendMode: 'NORMAL'
  }
}

function moveCommandsBlob(x: number, y: number): Uint8Array {
  const blob = new Uint8Array(10)
  const view = new DataView(blob.buffer)
  blob[0] = 1
  view.setFloat32(1, x, true)
  view.setFloat32(5, y, true)
  return blob
}

function quadraticCommandsBlob(): Uint8Array {
  const blob = new Uint8Array(18)
  const view = new DataView(blob.buffer)
  blob[0] = 3
  view.setFloat32(1, 2, true)
  view.setFloat32(5, 3, true)
  view.setFloat32(9, 4, true)
  view.setFloat32(13, 5, true)
  return blob
}

describe('vector geometry style fills', () => {
  test('scales derived zero-height vector networks for dashed instance strokes', () => {
    const graph = new SceneGraph()
    const target = graph.createNode('VECTOR', graph.getPages()[0].id, {
      width: 99,
      height: 0,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 99, y: 0 }
        ],
        segments: [
          {
            start: 0,
            end: 1,
            tangentStart: { x: 0, y: 0 },
            tangentEnd: { x: 0, y: 0 }
          }
        ],
        regions: []
      }
    })

    const geometry = resolveDsdGeometry({ size: { x: 421, y: 0 } }, target, [])

    expect(geometry.vectorNetwork?.vertices[1]?.x).toBe(421)
    expect(geometry.vectorNetwork?.vertices[1]?.y).toBe(0)
  })

  test('scales derived vector networks around their geometry origin', () => {
    const graph = new SceneGraph()
    const target = graph.createNode('VECTOR', graph.getPages()[0].id, {
      width: 10,
      height: 10,
      vectorNetwork: {
        vertices: [
          { x: 5, y: 7 },
          { x: 15, y: 17 }
        ],
        segments: [
          {
            start: 0,
            end: 1,
            tangentStart: { x: 1, y: 2 },
            tangentEnd: { x: 3, y: 4 }
          }
        ],
        regions: []
      }
    })

    const geometry = resolveDsdGeometry({ size: { x: 20, y: 30 } }, target, [])

    expect(geometry.vectorNetwork?.vertices).toEqual([
      { x: 5, y: 7 },
      { x: 25, y: 37 }
    ])
    expect(geometry.vectorNetwork?.segments[0]?.tangentStart).toEqual({ x: 2, y: 6 })
    expect(geometry.vectorNetwork?.segments[0]?.tangentEnd).toEqual({ x: 6, y: 12 })
  })

  test('resolves per-path paints without retaining transport style IDs', () => {
    const orange: Paint = {
      type: 'SOLID',
      color: { r: 1, g: 0.32, b: 0, a: 1 },
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL'
    }
    const fillsByStyleId = resolveStyleOverrideFills([
      { styleID: 4, fillPaints: [orange] },
      { styleID: 7, handleMirroring: 'ANGLE' }
    ])
    const paths = resolveGeometryPaths(
      [
        { windingRule: 'NONZERO', commandsBlob: 0, styleID: 4 },
        { windingRule: 'NONZERO', commandsBlob: 1, styleID: 0 }
      ],
      [moveCommandsBlob(0, 0), moveCommandsBlob(10, 0)],
      fillsByStyleId
    )

    expect(paths[0]?.fills?.[0]?.color).toEqual(orange.color)
    expect(paths[1]?.fills).toBeUndefined()
    expect(paths[0]).not.toHaveProperty('styleID')
  })

  test('resolves style fills from derived instance geometry', () => {
    const graph = new SceneGraph()
    const target = graph.createNode('VECTOR', graph.getPages()[0].id)
    const geometry = resolveDsdGeometry(
      {
        fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: 0, styleID: 3 }],
        vectorData: {
          styleOverrideTable: [
            {
              styleID: 3,
              fillPaints: [
                {
                  type: 'SOLID',
                  color: { r: 1, g: 0.32, b: 0, a: 1 },
                  opacity: 1,
                  visible: true
                }
              ]
            }
          ]
        }
      },
      target,
      [moveCommandsBlob(0, 0)]
    )

    expect(geometry.fillGeometry?.[0]?.fills?.[0]?.color.g).toBeCloseTo(0.32)
  })

  test('generates fresh style overrides when serializing current path fills', () => {
    const graph = new SceneGraph()
    const vector = graph.createNode('VECTOR', graph.getPages()[0].id, {
      name: 'Multi-color vector',
      width: 100,
      height: 40,
      fills: [solidFill(0.3, 0.06, 0.52)],
      vectorNetwork: null,
      fillGeometry: [
        {
          windingRule: 'NONZERO',
          commandsBlob: moveCommandsBlob(0, 0),
          fills: [solidFill(1, 0.32, 0)]
        },
        {
          windingRule: 'NONZERO',
          commandsBlob: moveCommandsBlob(50, 0),
          fills: [solidFill(0, 0.6, 0.9)]
        },
        { windingRule: 'NONZERO', commandsBlob: moveCommandsBlob(75, 0) }
      ]
    })
    const blobs: Uint8Array[] = []
    const [change] = sceneNodeToKiwi(
      vector,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      blobs
    )
    const vectorData = change.vectorData as { styleOverrideTable?: StyleOverride[] } | undefined

    expect(change.fillGeometry?.map((path) => path.styleID)).toEqual([1, 2, undefined])
    expect(vectorData?.styleOverrideTable?.map((override) => override.styleID)).toEqual([1, 2])
    expect(vectorData?.styleOverrideTable?.[0]?.fillPaints?.[0]?.color?.r).toBeCloseTo(1)
    expect(vectorData?.styleOverrideTable?.[1]?.fillPaints?.[0]?.color?.b).toBeCloseTo(0.9)
  })

  test('scaling geometry preserves independent path fills', () => {
    const source = [
      {
        windingRule: 'NONZERO' as const,
        commandsBlob: moveCommandsBlob(4, 5),
        fills: [solidFill(1, 0.32, 0)]
      },
      { windingRule: 'NONZERO' as const, commandsBlob: quadraticCommandsBlob() }
    ]
    const scaled = scaleGeometryPaths(source, 2, 3)
    const view = new DataView(scaled[0].commandsBlob.buffer)
    const quadraticView = new DataView(scaled[1].commandsBlob.buffer)

    expect(view.getFloat32(1, true)).toBe(8)
    expect(view.getFloat32(5, true)).toBe(15)
    expect([
      quadraticView.getFloat32(1, true),
      quadraticView.getFloat32(5, true),
      quadraticView.getFloat32(9, true),
      quadraticView.getFloat32(13, true)
    ]).toEqual([4, 9, 8, 15])
    expect(scaled[0].fills?.[0]?.color.r).toBe(1)
    if (scaled[0].fills?.[0]) scaled[0].fills[0].color.r = 0
    expect(source[0].fills?.[0]?.color.r).toBe(1)
  })
})
