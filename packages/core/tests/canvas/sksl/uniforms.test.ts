import { describe, expect, test } from 'bun:test'

import { getCanvasKit } from '@open-pencil/core/canvaskit'

import { compileProgram, defineShader, type Float2, packUniforms } from '#core/canvas/sksl'

const ck = await getCanvasKit()

const PROBE = defineShader<{ origin: Float2; depth: number; segments: ArrayLike<number> }>(
  'uniform probe',
  `uniform float2 origin;
   uniform float depth;
   uniform float4 segments[2];
   half4 main(float2 p) { return half4(origin.x + depth + segments[1].w); }`
)

describe('SkSL uniforms', () => {
  test('lays uniforms out as Skia reports them and packs named values into that layout', () => {
    const probe = compileProgram(ck, PROBE)
    try {
      expect(probe.layout).toEqual([
        { name: 'origin', slot: 0, floats: 2 },
        { name: 'depth', slot: 2, floats: 1 },
        { name: 'segments', slot: 3, floats: 8 }
      ])
      expect(
        probe.uniforms({
          depth: 3,
          segments: new Float32Array([4, 5, 6, 7, 8, 9, 10, 11]),
          origin: [1, 2]
        })
      ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    } finally {
      probe.effect.delete()
    }
  })

  test('refuses values that do not match the uniforms the SkSL declares', () => {
    const probe = compileProgram(ck, PROBE)
    try {
      expect(() => probe.uniforms({ origin: [1, 2], depth: 3, segments: [1, 2, 3] })).toThrow(
        'Uniform segments of the uniform probe takes 8 floats, not 3'
      )
      // Values from outside the program's type, as a script could pass them.
      const pack = (values: object) => packUniforms('uniform probe', probe.layout, values)
      expect(() =>
        pack({ origin: [1, 2], depth: 3, segments: new Float32Array(8), scale: 1 })
      ).toThrow('The uniform probe declares no uniform scale')
      expect(() => pack({ origin: [1, 2], segments: new Float32Array(8) })).toThrow(
        'The uniform probe needs a value for uniform depth'
      )
      expect(() => pack({ origin: [1, 'x'], depth: 3, segments: new Float32Array(8) })).toThrow(
        'Uniform origin of the uniform probe has no number at index 1'
      )
    } finally {
      probe.effect.delete()
    }
  })
})
