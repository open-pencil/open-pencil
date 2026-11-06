import type { Blender, Canvas, CanvasKit, Paint, Rect, RuntimeEffect, Shader } from 'canvaskit-wasm'

/** A shader kept while the uniforms it was made with, joined as `key`, still hold. */
interface KeptShader {
  key: string
  shader: Shader
}

/** Skia programs a renderer compiles on first use and keeps for the surface's lifetime. */
export interface CompiledShaders {
  diamondGradient: RuntimeEffect | null
  pixelGridEffect: RuntimeEffect | null
  pixelGrid: KeptShader | null
  dotGridEffect: RuntimeEffect | null
  dotGrid: KeptShader | null
  linearBurn: Blender | null
  linearDodge: Blender | null
}

type EffectSlot = 'diamondGradient' | 'pixelGridEffect' | 'dotGridEffect'
type ShaderSlot = 'pixelGrid' | 'dotGrid'

export function createCompiledShaders(): CompiledShaders {
  return {
    diamondGradient: null,
    pixelGridEffect: null,
    pixelGrid: null,
    dotGridEffect: null,
    dotGrid: null,
    linearBurn: null,
    linearDodge: null
  }
}

export function releaseCompiledShaders(shaders: CompiledShaders): void {
  shaders.diamondGradient?.delete()
  shaders.diamondGradient = null
  shaders.pixelGridEffect?.delete()
  shaders.pixelGridEffect = null
  shaders.pixelGrid?.shader.delete()
  shaders.pixelGrid = null
  shaders.dotGridEffect?.delete()
  shaders.dotGridEffect = null
  shaders.dotGrid?.shader.delete()
  shaders.dotGrid = null
  shaders.linearBurn?.delete()
  shaders.linearBurn = null
  shaders.linearDodge?.delete()
  shaders.linearDodge = null
}

/** The program in `slot`, compiled from `source` the first time; `name` says what failed to compile. */
export function compiledEffect(
  ck: CanvasKit,
  shaders: CompiledShaders,
  slot: EffectSlot,
  source: string,
  name: string
): RuntimeEffect {
  const kept = shaders[slot]
  if (kept) return kept
  let error = ''
  const effect = ck.RuntimeEffect.Make(source, (message) => {
    error = message
  })
  if (!effect) throw new Error(`Cannot compile the ${name}: ${error}`)
  shaders[slot] = effect
  return effect
}

/**
 * The shader in `slot`, made again from `effect` only when `uniforms` change, so repaints at the
 * same view, or tiles at the same zoom, share one.
 */
export function keptShader(
  shaders: CompiledShaders,
  slot: ShaderSlot,
  effect: RuntimeEffect,
  uniforms: number[]
): Shader {
  const key = uniforms.join(',')
  const kept = shaders[slot]
  if (kept?.key === key) return kept.shader
  kept?.shader.delete()
  const shader = effect.makeShader(uniforms)
  shaders[slot] = { key, shader }
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
