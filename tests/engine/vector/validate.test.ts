import { describe, test, expect } from 'bun:test'

import { validateVectorNetwork, type VectorNetwork } from '@open-pencil/core'

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
    expect(errors[0]).toContain('x and y must be numbers')
  })
})

