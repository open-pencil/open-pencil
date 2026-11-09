import { describe, expect, test } from 'bun:test'

import { packUniforms, uniformDeclarations, uniformLayout } from '#core/canvas/sksl'

const uniforms = {
  origin: 'float2',
  depth: 'float',
  segments: { type: 'float4', length: 2 }
} as const

describe('SkSL uniforms', () => {
  test('declares, lays out, and packs uniforms in their declaration order', () => {
    expect(uniformDeclarations(uniforms)).toBe(
      'uniform float2 origin;\nuniform float depth;\nuniform float4 segments[2];'
    )
    expect(uniformLayout(uniforms)).toEqual([
      { name: 'origin', slot: 0, floats: 2 },
      { name: 'depth', slot: 2, floats: 1 },
      { name: 'segments', slot: 3, floats: 8 }
    ])
    expect(
      packUniforms(uniforms, {
        origin: [1, 2],
        depth: 3,
        segments: new Float32Array([4, 5, 6, 7, 8, 9, 10, 11])
      })
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  test('refuses a value with more or fewer floats than its uniform', () => {
    expect(() =>
      packUniforms(uniforms, { origin: [1, 2], depth: 3, segments: [1, 2, 3] })
    ).toThrow('Uniform segments takes 8 floats, not 3')
  })
})
