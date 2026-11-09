import {
  packUniforms,
  uniformDeclarations,
  type UniformSpecs,
  type UniformValues
} from './uniforms'

/**
 * A program's body: the SkSL of a `.sksl` file imported with `?raw`, or several, such as a
 * snippet two programs share and each one's own code, joined in order.
 */
export type SkslBody = string | readonly string[]

/** A Skia runtime program: its SkSL, and the uniforms and child shaders it declares. */
export interface SkslProgram<U extends UniformSpecs = UniformSpecs> {
  /** What the program draws, as an error names it: "glass refraction". */
  readonly name: string
  readonly kind: 'shader' | 'blender'
  readonly uniforms: U
  /** Child shaders, in declaration order, as `makeShaderWithChildren` takes them. */
  readonly children: readonly string[]
  /** The whole program: declarations generated from the above, then the body. */
  readonly source: string
}

interface ProgramParts<U extends UniformSpecs> {
  uniforms: U
  /** Integer constants the body reads, such as loop bounds, declared as `const int`. */
  constants?: Readonly<Record<string, number>>
  body: SkslBody
}

/**
 * Every program defined, in the order modules defined them, so tests can compile each one the
 * renderer can reach without a list to keep in step.
 */
const programs: SkslProgram[] = []

function define<U extends UniformSpecs>(
  name: string,
  kind: SkslProgram['kind'],
  children: readonly string[],
  { uniforms, constants = {}, body }: ProgramParts<U>
): SkslProgram<U> {
  for (const [constant, value] of Object.entries(constants)) {
    if (!Number.isInteger(value)) throw new Error(`Constant ${constant} of ${name} is not an int`)
  }
  const declarations = [
    ...children.map((child) => `uniform shader ${child};`),
    uniformDeclarations(uniforms),
    ...Object.entries(constants).map(([constant, value]) => `const int ${constant} = ${value};`)
  ]
    .filter((line) => line.length > 0)
    .join('\n')
  const parts = typeof body === 'string' ? [body] : body
  const program = {
    name,
    kind,
    uniforms,
    children,
    source: `${[declarations, ...parts.map((part) => part.trim())].join('\n\n')}\n`
  }
  programs.push(program)
  return program
}

/** A runtime shader: its body holds `half4 main(float2 position)` and what it calls. */
export function defineShader<U extends UniformSpecs>(
  name: string,
  { children = [], ...parts }: ProgramParts<U> & { children?: readonly string[] }
): SkslProgram<U> {
  return define(name, 'shader', children, parts)
}

/** A runtime blender: its body holds `half4 main(half4 src, half4 dst)`. */
export function defineBlender<U extends UniformSpecs>(
  name: string,
  parts: ProgramParts<U>
): SkslProgram<U> {
  return define(name, 'blender', [], parts)
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
