import type { Editor } from '@open-pencil/core'

/**
 * Draws one fresh frame of a shader. The source is a WebGPU canvas that keeps the frame only
 * until the current task ends, so it is drawn from at once, never kept.
 */
export type ShaderFrameListener = (source: CanvasImageSource) => void

/**
 * Where the canvas's shader playback hands each frame it draws, by the image its paint shows,
 * to anything else that shows that shader: preview's islands draw their shader layers from it,
 * so every shader on the page has one player whatever shows it.
 */
export interface ShaderFrames {
  listen(image: string, listener: ShaderFrameListener): () => void
  publish(image: string, source: CanvasImageSource): void
}

const hubs = new WeakMap<Editor, ShaderFrames>()

/** The shader frames of `editor`'s documents, shared by its canvases and islands. */
export function shaderFrames(editor: Editor): ShaderFrames {
  let hub = hubs.get(editor)
  if (hub) return hub
  const listeners = new Map<string, Set<ShaderFrameListener>>()
  hub = {
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
  hubs.set(editor, hub)
  return hub
}
