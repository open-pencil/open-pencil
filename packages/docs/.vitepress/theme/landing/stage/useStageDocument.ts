import { getCurrentInstance, provide, ref } from 'vue'

import { COLLAB_KEY, useCollab } from '@/app/collab/use'
import { provideTabEditorStore } from '@/app/editor/active-store'
import { createTab, switchTab } from '@/app/tabs'

import { installAppPlugins } from './app-plugins'
import type { SceneBuilder } from './scenes'

/**
 * Gives the calling stage its own document and pins the component subtree to it, so several
 * stages can be live at once with each panel following its own canvas. Mirrors what
 * `src/App.vue` and `WorkspaceView.vue` provide around the app's workspace.
 */
export function useStageDocument(scene: SceneBuilder) {
  const instance = getCurrentInstance()
  if (instance) installAppPlugins(instance.appContext.app)

  const tab = createTab()
  const store = tab.store
  store.state.showRulers = false
  provideTabEditorStore(store)
  provide(COLLAB_KEY, useCollab())

  // The app's loading overlay shows while a preparation is open, so the canvas is covered
  // from the moment it mounts until the scene is built, and a failed build is reported there.
  const preparation = store.preparationController.begin({
    kind: 'demo-load',
    phase: 'materializing'
  })
  let built = false
  /** The scene is built and on the canvas. */
  const ready = ref(false)

  /** Builds the scene once the canvas has a renderer to load fonts into. Runs once. */
  async function build(): Promise<void> {
    if (built) return
    built = true
    try {
      await store.canvasReady
      await scene(store)
      preparation.complete()
      ready.value = true
    } catch (error) {
      preparation.fail({
        code: 'layout-failed',
        message: error instanceof Error ? error.message : String(error),
        retryable: false
      })
    }
  }

  /** App services outside this subtree follow the active tab, so interaction selects it. */
  function focus(): void {
    switchTab(tab.id)
  }

  return { store, build, focus, ready }
}
