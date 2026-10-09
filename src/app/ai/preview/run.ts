import { useEventListener } from '@vueuse/core'

import { createCanvasJSXPreview } from '@/app/ai/preview/canvas'
import { markRunPreview, runAgentId, runPageId } from '@/app/ai/tools/run'
import type { EditorStore } from '@/app/editor/active-store'
import { publishAgentPreview } from '@/app/presence/preview-stream'

/**
 * The chat run's preview of streamed `render` input: drawn on this canvas, with the run's agent
 * pointing at what it builds, and published so a room shows it to everyone else as it streams.
 */
export function createRunPreview(store: EditorStore) {
  const preview = createCanvasJSXPreview(store, () => runPageId(store), {
    onFocus: (focus) => markRunPreview(store, focus)
  })

  /** Stops each call's abort listener; the request's signal outlives the calls it covers. */
  const stopAbortListeners = new Map<string, () => void>()

  function stopAbortListener(callId: string): void {
    stopAbortListeners.get(callId)?.()
    stopAbortListeners.delete(callId)
  }

  return {
    start(callId: string, signal?: AbortSignal): void {
      preview.start(callId, signal)
      const agentId = runAgentId(store)
      if (!agentId) return
      publishAgentPreview(store, { type: 'start', agentId, callId, pageId: runPageId(store) })
      // A stopped call ends its preview here, so it ends everywhere else too.
      if (signal) {
        stopAbortListener(callId)
        stopAbortListeners.set(
          callId,
          useEventListener(
            signal,
            'abort',
            () => {
              stopAbortListeners.delete(callId)
              publishAgentPreview(store, { type: 'finish', agentId, callId })
            },
            { once: true }
          )
        )
      }
    },
    delta(callId: string, text: string): void {
      preview.delta(callId, text)
      const agentId = runAgentId(store)
      if (agentId) publishAgentPreview(store, { type: 'delta', agentId, callId, text })
    },
    finish(callId: string): void {
      stopAbortListener(callId)
      preview.finish(callId)
      const agentId = runAgentId(store)
      if (agentId) publishAgentPreview(store, { type: 'finish', agentId, callId })
    },
    clear(): void {
      for (const stop of stopAbortListeners.values()) stop()
      stopAbortListeners.clear()
      preview.clear()
      const agentId = runAgentId(store)
      if (agentId) publishAgentPreview(store, { type: 'clear', agentId })
    }
  }
}
