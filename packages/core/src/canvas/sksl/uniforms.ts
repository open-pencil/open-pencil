/** How many floats each SkSL uniform type holds. */
const TYPE_FLOATS = { float: 1, float2: 2, float3: 3, float4: 4 } as const

export type UniformType = keyof typeof TYPE_FLOATS

/** A uniform: one value of a type, or an array of `length` of them. */
export type UniformSpec = UniformType | { readonly type: UniformType; readonly length: number }

/** A program's uniforms in declaration order, which is the order Skia lays them out in. */
export type UniformSpecs = Readonly<Record<string, UniformSpec>>

/** What each uniform type takes. */
interface TypeValues {
  float: number
  float2: readonly [number, number]
  float3: readonly [number, number, number]
  float4: readonly [number, number, number, number]
}

/** What a uniform takes: its type's value, or an array's floats end to end. */
type UniformValue<S extends UniformSpec> = S extends UniformType ? TypeValues[S] : ArrayLike<number>

export type UniformValues<U extends UniformSpecs> = { readonly [K in keyof U]: UniformValue<U[K]> }

/** A uniform as Skia lays it out: where its floats start in the packed array, and how many. */
export interface UniformSlot {
  name: string
  slot: number
  floats: number
}

function typeOf(spec: UniformSpec): UniformType {
  return typeof spec === 'string' ? spec : spec.type
}

function floatsOf(spec: UniformSpec): number {
  return TYPE_FLOATS[typeOf(spec)] * (typeof spec === 'string' ? 1 : spec.length)
}

/** The `uniform` lines that declare `uniforms` in SkSL. */
export function uniformDeclarations(uniforms: UniformSpecs): string {
  return Object.entries(uniforms)
    .map(([name, spec]) =>
      typeof spec === 'string'
        ? `uniform ${spec} ${name};`
        : `uniform ${spec.type} ${name}[${spec.length}];`
    )
    .join('\n')
}

/** Where each uniform's floats sit in the packed array, in declaration order. */
export function uniformLayout(uniforms: UniformSpecs): UniformSlot[] {
  let slot = 0
  return Object.entries(uniforms).map(([name, spec]) => {
    const floats = floatsOf(spec)
    const entry = { name, slot, floats }
    slot += floats
    return entry
  })
}

/**
 * `values` as the float array Skia takes, in declaration order. Throws when a value holds more or
 * fewer floats than its uniform, so a program and its caller cannot drift apart unnoticed.
 */
export function packUniforms<U extends UniformSpecs>(
  uniforms: U,
  values: UniformValues<U>
): number[] {
  const packed: number[] = []
  for (const [name, spec] of Object.entries(uniforms)) {
    const value: number | ArrayLike<number> = values[name]
    const floats = floatsOf(spec)
    if (typeof value === 'number') {
      if (floats !== 1) throw new Error(`Uniform ${name} takes ${floats} floats, not 1`)
      packed.push(value)
      continue
    }
    if (value.length !== floats) {
      throw new Error(`Uniform ${name} takes ${floats} floats, not ${value.length}`)
    }
    packed.push(...Array.from(value))
  }
  return packed
}
