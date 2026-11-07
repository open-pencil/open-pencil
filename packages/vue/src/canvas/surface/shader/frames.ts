import { inject, provide, type InjectionKey } from 'vue'

/**
 * Draws one fresh frame of a shader. The source is a WebGPU canvas that keeps the frame only
 * until the current task ends, so it is drawn from at once, never kept.
 */
export type ShaderFrameListener = (source: CanvasImageSource) => void

/**
 * Where a canvas's shader playback hands each frame it draws, by the image its paint shows, to
 * anything else on that canvas that shows that shader: preview's islands draw their shader
 * layers from it, so every shader on the page has one player whatever shows it.
 */
export interface ShaderFrames {
  listen(image: string, listener: ShaderFrameListener): () => void
  publish(image: string, source: CanvasImageSource): void
}

/**
 * One canvas's frames. Split panes each play their own shaders at their own size, so a hub
 * per editor would let one pane's islands draw the other pane's frames.
 */
const SHADER_FRAMES_KEY: InjectionKey<ShaderFrames> = Symbol('shader-frames')

function createShaderFrames(): ShaderFrames {
  const listeners = new Map<string, Set<ShaderFrameListener>>()
  return {
    listen(image, listener) {
      const set = listeners.get(image) ?? new Set()
      set.add(listener)
      listeners.set(image, set)
      return () => {
        set.delete(listener)
        if (set.size === 0) listeners.delete(image)
      }
    },
    publish(image, source) {
      for (const listener of listeners.get(image) ?? []) listener(source)
    }
  }
}

/** The frames this canvas plays, offered to the islands drawn over it. Call during setup. */
export function provideShaderFrames(): ShaderFrames {
  const frames = createShaderFrames()
  provide(SHADER_FRAMES_KEY, frames)
  return frames
}

/** The frames of the canvas this component is drawn over, or none outside a playing canvas. */
export function useShaderFrames(): ShaderFrames | null {
  return inject(SHADER_FRAMES_KEY, null)
}
