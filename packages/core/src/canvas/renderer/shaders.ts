import type { Blender, RuntimeEffect, Shader } from 'canvaskit-wasm'

/** Skia programs a renderer compiles on first use and keeps for the surface's lifetime. */
export interface CompiledShaders {
  diamondGradient: RuntimeEffect | null
  pixelGridEffect: RuntimeEffect | null
  /** The pixel grid's shader, kept while its uniforms hold. */
  pixelGrid: { key: string; shader: Shader } | null
  linearBurn: Blender | null
  linearDodge: Blender | null
}

export function createCompiledShaders(): CompiledShaders {
  return {
    diamondGradient: null,
    pixelGridEffect: null,
    pixelGrid: null,
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
  shaders.linearBurn?.delete()
  shaders.linearBurn = null
  shaders.linearDodge?.delete()
  shaders.linearDodge = null
}
