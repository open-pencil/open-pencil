import { computed, type ComputedRef } from 'vue'

import { useEditor } from '#vue/editor/context'

/**
 * Convenience wrapper for scene-derived computed state.
 *
 * Use this for values that should clearly read as editor/scene-backed derived
 * state in higher-level composables.
 */
export function useSceneComputed<T>(fn: () => T): ComputedRef<T> {
  const editor = useEditor()
  return computed(() => {
    void editor.state.sceneVersion
    void editor.state.selectedIds
    void editor.state.currentPageId
    return fn()
  })
}
