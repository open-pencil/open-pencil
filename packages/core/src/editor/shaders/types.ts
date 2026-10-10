import type { ShaderPreset } from '@open-pencil/scene-graph'
import type { Size } from '@open-pencil/scene-graph/primitives'

/**
 * Draws a shader's still frame. Core has no GPU or DOM, so the canvas that has them supplies
 * one; without it, or where it cannot draw, a shader paint keeps the frame it was saved with.
 */
export interface ShaderRasterizer {
  /** PNG bytes of `preset`'s first frame at `size` pixels, or null when it cannot draw here. */
  render(preset: ShaderPreset, size: Size): Promise<Uint8Array | null>
  destroy?(): void
}
