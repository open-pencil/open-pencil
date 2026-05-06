import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

import { canvas, doc, node } from './helpers'

describe('fig-import: arc data', () => {
  test('partial ellipse', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('ELLIPSE', 10, 1, {
        arcData: {
          startingAngle: 0,
          endingAngle: Math.PI,
          innerRadius: 0
        }
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.arcData).toBeDefined()
    const arcData = expectDefined(n.arcData, 'ellipse arc data')
    expect(arcData.startingAngle).toBe(0)
    expect(arcData.endingAngle).toBeCloseTo(Math.PI)
    expect(arcData.innerRadius).toBe(0)
  })

  test('donut (inner radius)', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('ELLIPSE', 10, 1, {
        arcData: {
          startingAngle: 0,
          endingAngle: Math.PI * 2,
          innerRadius: 0.5
        }
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.arcData?.innerRadius).toBe(0.5)
  })
})
