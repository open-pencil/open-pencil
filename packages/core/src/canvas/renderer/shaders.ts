import type {
  Blender,
  Canvas,
  CanvasKit,
  Paint,
  Rect,
  RuntimeEffect,
  Shader
} from '@open-pencil/canvaskit'

import { compileProgram, type SkslProgram } from '#core/canvas/sksl'

/** A shader kept while the uniforms it was made with, joined as `key`, still hold. */
interface KeptShader {
  key: string
  shader: Shader
}

/** Skia programs a renderer compiles on first use and keeps for the surface's lifetime. */
export interface CompiledShaders {
  effects: Map<SkslProgram, RuntimeEffect>
  blenders: Map<SkslProgram, Blender>
  kept: Map<SkslProgram, KeptShader>
}

export function createCompiledShaders(): CompiledShaders {
  return { effects: new Map(), blenders: new Map(), kept: new Map() }
}

export function releaseCompiledShaders(shaders: CompiledShaders): void {
  for (const effect of shaders.effects.values()) effect.delete()
  for (const blender of shaders.blenders.values()) blender.delete()
  for (const { shader } of shaders.kept.values()) shader.delete()
  shaders.effects.clear()
  shaders.blenders.clear()
  shaders.kept.clear()
}

/** `program`, compiled the first time this renderer draws with it. */
export function compiledEffect(
  ck: CanvasKit,
  shaders: CompiledShaders,
  program: SkslProgram
): RuntimeEffect {
  const kept = shaders.effects.get(program)
  if (kept) return kept
  const effect = compileProgram(ck, program)
  shaders.effects.set(program, effect)
  return effect
}

/** The blender `program` makes, with no uniforms, made the first time this renderer uses it. */
export function compiledBlender(
  ck: CanvasKit,
  shaders: CompiledShaders,
  program: SkslProgram<Record<string, never>>
): Blender {
  const kept = shaders.blenders.get(program)
  if (kept) return kept
  const blender = compiledEffect(ck, shaders, program).makeBlender([])
  shaders.blenders.set(program, blender)
  return blender
}

/**
 * `program`'s shader, made again only when `uniforms` change, so repaints at the same view, or
 * tiles at the same zoom, share one.
 */
export function keptShader(
  ck: CanvasKit,
  shaders: CompiledShaders,
  program: SkslProgram,
  uniforms: number[]
): Shader {
  const key = uniforms.join(',')
  const kept = shaders.kept.get(program)
  if (kept?.key === key) return kept.shader
  kept?.shader.delete()
  const shader = compiledEffect(ck, shaders, program).makeShader(uniforms)
  shaders.kept.set(program, { key, shader })
  return shader
}

/**
 * Fills `rect`, or the whole clip without one, with `shader` through `paint`. The paint is made
 * opaque first, since Skia scales a shader by the paint's alpha and earlier drawing may have left
 * it translucent, and gives the shader up after.
 */
export function fillWithShader(canvas: Canvas, paint: Paint, shader: Shader, rect?: Rect): void {
  paint.setAlphaf(1)
  paint.setShader(shader)
  if (rect) canvas.drawRect(rect, paint)
  else canvas.drawPaint(paint)
  paint.setShader(null)
}
