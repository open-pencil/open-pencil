import type { EditorStore } from '@/app/editor/session/create'
import type { NavigationRecording, NavigationRecorder } from '@/app/performance/navigation/recorder'
import { startNavigationRecorder } from '@/app/performance/navigation/recorder'

export interface NavigationBenchmarkHooks {
  startRecording: (name: string) => void
  waitForSettlement: (timeoutMs?: number) => Promise<void>
  stopRecording: () => NavigationRecording
}

let recorder: NavigationRecorder | null = null

export function createNavigationBenchmarkHooks(store: EditorStore): NavigationBenchmarkHooks {
  return {
    startRecording(name) {
      if (recorder) throw new Error('A navigation recording is already active')
      const canvas = document.querySelector<HTMLCanvasElement>('[data-test-id="canvas-element"]')
      if (!canvas) throw new Error('Canvas element not found')
      recorder = startNavigationRecorder(
        canvas,
        name,
        {
          panX: store.state.panX,
          panY: store.state.panY,
          zoom: store.state.zoom
        },
        store.canvasRenderers.some(
          (renderer) => renderer.tracksSceneSettlement && renderer.tiledSceneEnabled
        )
          ? 'tiled'
          : 'existing'
      )
    },
    async waitForSettlement(timeoutMs = 30_000) {
      const startedAt = performance.now()
      await new Promise<void>((resolve, reject) => {
        let frameId: number | null = null
        const check = () => {
          const renderers = store.canvasRenderers.filter(
            (renderer) => renderer.tracksSceneSettlement && renderer.pageId !== null
          )
          const settled =
            store.state.navigation.phase === 'idle' &&
            renderers.length > 0 &&
            renderers.every((renderer) =>
              renderer.tiledSceneEnabled
                ? renderer.tiledSceneCovered && !renderer.tiledScenePending
                : !renderer.sceneBackingNeedsCrispRender
            )
          if (settled) {
            resolve()
            return
          }
          if (performance.now() - startedAt >= timeoutMs) {
            const state = renderers.map((renderer) => ({
              tiled: renderer.tiledSceneEnabled,
              covered: renderer.tiledSceneCovered,
              pending: renderer.tiledScenePending,
              backingCrisp: !renderer.sceneBackingNeedsCrispRender
            }))
            reject(
              new Error(
                `Navigation renderer did not settle within ${timeoutMs} ms: ${JSON.stringify({
                  navigationPhase: store.state.navigation.phase,
                  renderers: state
                })}`
              )
            )
            return
          }
          frameId = requestAnimationFrame(check)
        }
        frameId = requestAnimationFrame(check)
        void frameId
      })
    },
    stopRecording() {
      if (!recorder) throw new Error('No navigation recording is active')
      const result = recorder.stop()
      recorder = null
      return result
    }
  }
}
