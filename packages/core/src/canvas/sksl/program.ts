import type { Uniforms } from './uniforms'

/** A Skia runtime program, as complete SkSL: its uniforms and child shaders are declared in it. */
export interface SkslProgram<U extends object = object> {
  /** What the program draws, as an error names it: "glass refraction". */
  readonly name: string
  readonly kind: 'shader' | 'blender'
  readonly source: string
  /** Type only: the values the program's uniforms take, never set. */
  readonly uniforms?: U
}

/** No uniforms. */
export type NoUniforms = Readonly<Record<string, never>>

/**
 * Every program defined, in the order modules defined them, so tests can compile each one the
 * renderer can reach without a list to keep in step.
 */
const programs: SkslProgram[] = []

function define<U extends object>(
  name: string,
  kind: SkslProgram['kind'],
  parts: readonly string[]
): SkslProgram<U> {
  const program = { name, kind, source: `${parts.map((part) => part.trim()).join('\n\n')}\n` }
  programs.push(program)
  return program
}

/**
 * A runtime shader from the SkSL of `.sksl` files imported with `?raw`, joined in order, such as
 * a snippet two programs share and each one's own code. `U` names the values its uniforms take.
 */
export function defineShader<U extends Uniforms<U> = NoUniforms>(
  name: string,
  ...parts: readonly string[]
): SkslProgram<U> {
  return define(name, 'shader', parts)
}

/** A runtime blender: its SkSL holds `half4 main(half4 src, half4 dst)`. */
export function defineBlender<U extends Uniforms<U> = NoUniforms>(
  name: string,
  ...parts: readonly string[]
): SkslProgram<U> {
  return define(name, 'blender', parts)
}

/** Every program the loaded modules define. */
export function definedPrograms(): readonly SkslProgram[] {
  return programs
}
