import type { CanvasKit, RuntimeEffect } from '@open-pencil/canvaskit'

import type { SkslProgram } from './program'

/**
 * Compiles `program` with CanvasKit's SkSL compiler; throws with Skia's message when it does not
 * compile. The only place a runtime effect is made from source (`open-pencil/no-raw-runtime-effect`).
 */
export function compileProgram(ck: CanvasKit, program: SkslProgram): RuntimeEffect {
  let error = ''
  const onError = (message: string) => {
    error = message
  }
  const effect =
    program.kind === 'blender'
      ? ck.RuntimeEffect.MakeForBlender(program.source, onError)
      : ck.RuntimeEffect.Make(program.source, onError)
  if (!effect) throw new Error(`Cannot compile the ${program.name}: ${error}`)
  return effect
}
