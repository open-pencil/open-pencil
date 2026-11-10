import type { CanvasKit, RuntimeEffect } from '@open-pencil/canvaskit'

import type { SkslProgram } from './program'
import { packUniforms, type UniformSlot, uniformLayout } from './uniforms'

/** A compiled program, and its uniforms as Skia laid them out. */
export interface CompiledProgram<U extends object = object> {
  readonly effect: RuntimeEffect
  readonly layout: readonly UniformSlot[]
  /** `values` as the float array `effect` takes; throws when they do not match its uniforms. */
  uniforms(values: U): number[]
}

/**
 * Compiles `program` with CanvasKit's SkSL compiler; throws with Skia's message when it does not
 * compile. The only place a runtime effect is made from source (`open-pencil/no-raw-runtime-effect`).
 */
export function compileProgram<U extends object>(
  ck: CanvasKit,
  program: SkslProgram<U>
): CompiledProgram<U> {
  let error = ''
  const onError = (message: string) => {
    error = message
  }
  const effect =
    program.kind === 'blender'
      ? ck.RuntimeEffect.MakeForBlender(program.source, onError)
      : ck.RuntimeEffect.Make(program.source, onError)
  if (!effect) throw new Error(`Cannot compile the ${program.name}: ${error}`)
  const layout = uniformLayout(effect)
  return { effect, layout, uniforms: (values) => packUniforms(program.name, layout, values) }
}
