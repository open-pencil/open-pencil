import { inject, provide, type InjectionKey } from 'vue'

import type { Editor } from '@open-pencil/core'

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

/**
 * Every frame any canvas of an editor plays, for islands mounted outside a canvas, such as an SDK
 * app placing `PlayIslands` beside `CanvasRoot` rather than inside it.
 */
const editorHubs = new WeakMap<Editor, ShaderFrames>()

function editorFrames(editor: Editor): ShaderFrames {
  let hub = editorHubs.get(editor)
  if (!hub) {
    hub = createShaderFrames()
    editorHubs.set(editor, hub)
  }
  return hub
}

/**
 * Where this canvas publishes the frames it plays: to the islands drawn over it, which it offers
 * them to, and to islands of the same editor that no canvas holds. Call during setup.
 */
export function provideShaderFrames(editor: Editor): ShaderFrames {
  const own = createShaderFrames()
  const shared = editorFrames(editor)
  provide(SHADER_FRAMES_KEY, own)
  return {
    listen: own.listen,
    publish(image, source) {
      own.publish(image, source)
      shared.publish(image, source)
    }
  }
}

/**
 * The frames an island draws from: the canvas it is drawn over, or, outside any canvas, every
 * canvas of its editor.
 */
export function useShaderFrames(editor: Editor): ShaderFrames {
  return inject(SHADER_FRAMES_KEY, null) ?? editorFrames(editor)
}
