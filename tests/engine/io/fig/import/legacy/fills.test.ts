import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

import { canvas, doc, node } from './helpers'

describe('fig-import: gradient fills', () => {
  test('linear gradient', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('RECTANGLE', 10, 1, {
        fillPaints: [
          {
            type: 'GRADIENT_LINEAR',
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL',
            stops: [
              { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
              { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
            ],
            transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
          }
        ] as NodeChange['fillPaints']
      })
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.fills).toHaveLength(1)
    expect(n.fills[0].type).toBe('GRADIENT_LINEAR')
    expect(n.fills[0].gradientStops).toHaveLength(2)
    const gradientStops = expectDefined(n.fills[0].gradientStops, 'linear gradient stops')
    expect(gradientStops[0]?.color.r).toBe(1)
    expect(gradientStops[1]?.color.b).toBe(1)
    expect(n.fills[0].gradientTransform).toBeDefined()
  })

  test('radial gradient', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('ELLIPSE', 10, 1, {
        fillPaints: [
          {
            type: 'GRADIENT_RADIAL',
            opacity: 0.8,
            visible: true,
            blendMode: 'NORMAL',
            stops: [
              { color: { r: 1, g: 1, b: 1, a: 1 }, position: 0 },
              { color: { r: 0, g: 0, b: 0, a: 1 }, position: 1 }
            ],
            transform: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 }
          }
        ] as NodeChange['fillPaints']
      })
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.fills[0].type).toBe('GRADIENT_RADIAL')
    expect(n.fills[0].opacity).toBe(0.8)
    expect(n.fills[0].gradientStops).toHaveLength(2)
  })
})
