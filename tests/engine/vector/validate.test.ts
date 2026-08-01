import { describe, test, expect } from 'bun:test'

import {
  normalizeVectorNetwork,
  validateVectorNetwork,
  type VectorNetwork
} from '@open-pencil/core'

describe('validateVectorNetwork', () => {
  test('valid network returns no errors', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
    expect(validateVectorNetwork(network)).toEqual([])
  })

  test('segments without tangents are valid (normalize handles them)', () => {
    const network = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ],
      segments: [{ start: 0, end: 1 }],
      regions: []
    } as VectorNetwork
    expect(validateVectorNetwork(network)).toEqual([])
  })

  test('rejects segment with out-of-range start index', () => {
    const network = {
      vertices: [{ x: 0, y: 0 }],
      segments: [{ start: 0, end: 5 }],
      regions: []
    } as VectorNetwork
    const errors = validateVectorNetwork(network)
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('end index 5 out of range')
  })

  test('rejects missing vertices array', () => {
    const network = { segments: [], regions: [] } as VectorNetwork
    const errors = validateVectorNetwork(network)
    expect(errors[0]).toContain('vertices must be an array')
  })

  test('rejects vertex with non-number coordinates', () => {
    const network = {
      vertices: [{ x: 'a', y: 0 }],
      segments: [],
      regions: []
    } as VectorNetwork
    const errors = validateVectorNetwork(network)
    expect(errors[0]).toContain('x and y must be finite numbers')
  })

  test('rejects non-object input without throwing', () => {
    expect(validateVectorNetwork(null)).toEqual(['network must be an object'])
    expect(validateVectorNetwork('not a network')).toEqual(['network must be an object'])
  })

  test('accepts and normalizes omitted regions like the Figma Plugin API', () => {
    const network = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      segments: [{ start: 0, end: 1 }]
    }

    expect(validateVectorNetwork(network)).toEqual([])
    expect(normalizeVectorNetwork(network).regions).toEqual([])
  })

  test('rejects a non-array regions value', () => {
    const errors = validateVectorNetwork({ vertices: [], segments: [], regions: {} } as never)
    expect(errors).toContain('regions must be an array when provided')
  })

  test('rejects invalid region topology', () => {
    const errors = validateVectorNetwork({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 }
      ],
      segments: [
        { start: 0, end: 1 },
        { start: 2, end: 3 },
        { start: 1, end: 2 }
      ],
      regions: [
        { windingRule: 'INVALID', loops: [[3]] },
        { windingRule: 'NONZERO', loops: [] },
        { windingRule: 'NONZERO', loops: [[]] },
        { windingRule: 'NONZERO', loops: [[0, 0]] },
        { windingRule: 'NONZERO', loops: [[0, 1]] }
      ]
    })

    expect(errors).toContain('region[0]: windingRule must be NONZERO or EVENODD')
    expect(errors).toContain('region[0].loop[0]: segment index 3 out of range')
    expect(errors).toContain('region[1]: loops must contain at least one loop')
    expect(errors).toContain('region[2].loop[0] must contain at least one segment')
    expect(errors).toContain('region[3].loop[0] must not repeat segments')
    expect(errors).toContain('region[4].loop[0] segments must form a continuous chain')
  })
})
