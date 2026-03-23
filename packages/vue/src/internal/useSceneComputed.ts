import { computed, type ComputedRef } from 'vue'

import { useEditor } from '../context/editorContext'

/**
 * Creates a computed ref that re-evaluates when the scene graph changes.
 *
 * Tracks `state.sceneVersion` — a counter on a shallowReactive object
 * that the core editor increments synchronously on every mutation via
 * requestRender(). Vue tracks the read automatically, so the computed
 * re-evaluates in the same tick as the change. Zero latency.
 */
export function useSceneComputed<T>(fn: () => T): ComputedRef<T> {
  const editor = useEditor()
  return computed(() => {
    void editor.state.sceneVersion
    return fn()
  })
}
