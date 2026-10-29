import type { Size } from '@open-pencil/scene-graph/primitives'
import type { ShaderPreset } from '@open-pencil/scene-graph/shaders'

/**
 * Draws a shader's still frame. Core has no GPU or DOM, so the canvas that has them supplies
 * one; without it, or where it cannot draw, a shader paint keeps the frame it was saved with.
 */
export interface ShaderRasterizer {
  /**
   * `preset`'s first frame at `size` pixels, encoded as `shaderFrameEncoding` picks, or null
   * when it cannot draw here.
   */
  render(preset: ShaderPreset, size: Size): Promise<Uint8Array | null>
  destroy?(): void
}
