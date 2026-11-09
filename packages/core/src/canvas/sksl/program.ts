import dedent from 'dedent'

import {
  packUniforms,
  uniformDeclarations,
  type UniformSpecs,
  type UniformValues
} from './uniforms'

/**
 * SkSL source as a template, dedented so it reads as written. Interpolate single values only:
 * `dedent` re-indents a multi-line value, so a snippet two programs share goes in their `body`
 * as a part of its own.
 */
export const sksl = dedent

/** A program's body: its source, or parts such as a shared snippet and its own code. */
export type SkslBody = string | readonly string[]

/** A Skia runtime program: its SkSL, and the uniforms and child shaders it declares. */
export interface SkslProgram<U extends UniformSpecs = UniformSpecs> {
  /** What the program draws, as an error names it: "glass refraction". */
  readonly name: string
  readonly kind: 'shader' | 'blender'
  readonly uniforms: U
  /** Child shaders, in declaration order, as `makeShaderWithChildren` takes them. */
  readonly children: readonly string[]
  /** The whole program: child and uniform declarations, then the body. */
  readonly source: string
}

/**
 * Every program defined, in the order modules defined them, so tests can compile each one the
 * renderer can reach without a list to keep in step.
 */
const programs: SkslProgram[] = []

function define<U extends UniformSpecs>(
  name: string,
  kind: SkslProgram['kind'],
  uniforms: U,
  children: readonly string[],
  body: SkslBody
): SkslProgram<U> {
  const parts = typeof body === 'string' ? [body] : body
  const declarations = [
    ...children.map((child) => `uniform shader ${child};`),
    uniformDeclarations(uniforms)
  ].filter((line) => line.length > 0)
  const program = {
    name,
    kind,
    uniforms,
    children,
    source: `${[declarations.join('\n'), ...parts].join('\n\n')}\n`
  }
  programs.push(program)
  return program
}

/** A runtime shader: `body` holds `half4 main(float2 position)` and what it calls. */
export function defineShader<U extends UniformSpecs>(
  name: string,
  { uniforms, children = [], body }: { uniforms: U; children?: readonly string[]; body: SkslBody }
): SkslProgram<U> {
  return define(name, 'shader', uniforms, children, body)
}

/** A runtime blender: `body` holds `half4 main(half4 src, half4 dst)`. */
export function defineBlender<U extends UniformSpecs>(
  name: string,
  { uniforms, body }: { uniforms: U; body: SkslBody }
): SkslProgram<U> {
  return define(name, 'blender', uniforms, [], body)
}

/** Every program the loaded modules define. */
export function definedPrograms(): readonly SkslProgram[] {
  return programs
}

/** `program`'s uniforms as the float array Skia takes, checked against their declarations. */
export function programUniforms<U extends UniformSpecs>(
  program: SkslProgram<U>,
  values: UniformValues<U>
): number[] {
  return packUniforms(program.uniforms, values)
}
