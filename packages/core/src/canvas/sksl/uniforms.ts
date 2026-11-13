import type { RuntimeEffect } from '@open-pencil/canvaskit'

export type Float2 = readonly [number, number]
export type Float3 = readonly [number, number, number]
export type Float4 = readonly [number, number, number, number]

/** A uniform's value: a float, a vector, or an array's floats end to end. */
export type UniformValue = number | ArrayLike<number>

/** What `U` must be to name a program's uniform values: each of its fields a uniform's value. */
export type Uniforms<U> = { readonly [K in keyof U]: UniformValue }

function isUniformValue(value: unknown): value is UniformValue {
  return (
    typeof value === 'number' || (typeof value === 'object' && value !== null && 'length' in value)
  )
}

/** A uniform as Skia lays it out: where its floats start in the packed array, and how many. */
export interface UniformSlot {
  name: string
  slot: number
  floats: number
}

/**
 * The uniforms `effect` declares, as Skia's compiler reports them, in its layout order. A
 * uniform's size is where the next one starts, since Skia reports no array lengths.
 */
export function uniformLayout(effect: RuntimeEffect): UniformSlot[] {
  const total = effect.getUniformFloatCount()
  const starts = Array.from({ length: effect.getUniformCount() }, (_, index) => ({
    name: effect.getUniformName(index),
    slot: effect.getUniform(index).slot
  }))
  return starts.map((uniform, index) => ({
    ...uniform,
    floats: (starts.at(index + 1)?.slot ?? total) - uniform.slot
  }))
}

/**
 * `values` as the float array Skia takes for uniforms laid out as `layout`. Throws, naming
 * `program`, when a uniform has no value or one of the wrong size, or a value has no uniform, so
 * a program and its caller cannot drift apart unnoticed.
 */
export function packUniforms(
  program: string,
  layout: readonly UniformSlot[],
  values: object
): number[] {
  const declared = new Set(layout.map((uniform) => uniform.name))
  const unknown = Object.keys(values).find((name) => !declared.has(name))
  if (unknown) throw new Error(`The ${program} declares no uniform ${unknown}`)
  const packed: number[] = []
  for (const { name, floats } of layout) {
    const value: unknown = Reflect.get(values, name)
    if (!isUniformValue(value)) {
      throw new Error(`The ${program} needs a value for uniform ${name}`)
    }
    const given = typeof value === 'number' ? 1 : value.length
    if (given !== floats) {
      throw new Error(`Uniform ${name} of the ${program} takes ${floats} floats, not ${given}`)
    }
    if (typeof value === 'number') {
      packed.push(value)
      continue
    }
    for (let i = 0; i < given; i++) {
      const element: unknown = value[i]
      if (typeof element !== 'number') {
        throw new TypeError(`Uniform ${name} of the ${program} has no number at index ${i}`)
      }
      packed.push(element)
    }
  }
  return packed
}
