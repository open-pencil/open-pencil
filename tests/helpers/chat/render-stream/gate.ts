import { until, useEventListener } from '@vueuse/core'
import { effectScope, ref, shallowRef } from 'vue'

/** Explicit checkpoints for visual assertions; no timing assumptions or private SDK hooks. */
export function createStreamGate<Chunk>(isCheckpoint: (chunk: Chunk) => boolean) {
  const permits = ref(0)
  const opened = ref(false)
  const closed = ref(false)
  const failure = shallowRef<Error>()
  // Owns the abort listeners of the requests this gate follows.
  const listeners = effectScope(true)

  function close() {
    closed.value = true
    listeners.stop()
  }

  const transform = new TransformStream<Chunk, Chunk>({
    async transform(chunk, controller) {
      if (isCheckpoint(chunk)) {
        await until(
          () => opened.value || permits.value > 0 || closed.value || failure.value !== undefined
        ).toBe(true)
        if (permits.value > 0) permits.value--
      }
      if (failure.value) throw failure.value
      if (!closed.value) controller.enqueue(chunk)
    },
    flush: () => listeners.stop()
  })

  return {
    transform,
    follow(signal?: AbortSignal) {
      if (!signal || closed.value) return
      if (signal.aborted) close()
      else listeners.run(() => useEventListener(signal, 'abort', close, { once: true }))
    },
    advance() {
      permits.value++
    },
    open() {
      opened.value = true
    },
    fail() {
      failure.value = new Error('Provider disconnected')
      listeners.stop()
    },
    close
  }
}
