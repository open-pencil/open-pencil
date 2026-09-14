/** Explicit checkpoints for visual assertions; no timing assumptions or private SDK hooks. */
export function createStreamGate<Chunk>(isCheckpoint: (chunk: Chunk) => boolean) {
  let permits = 0
  let opened = false
  let closed = false
  let failure: Error | undefined
  let resume: (() => void) | undefined
  const signals = new Set<AbortSignal>()

  function detach() {
    for (const signal of signals) signal.removeEventListener('abort', close)
    signals.clear()
  }

  function close() {
    closed = true
    detach()
    resume?.()
  }

  const transform = new TransformStream<Chunk, Chunk>({
    async transform(chunk, controller) {
      if (isCheckpoint(chunk)) {
        if (!opened && permits === 0 && !closed && !failure) {
          await new Promise<void>((resolve) => {
            resume = resolve
          })
        }
        if (permits > 0) permits--
      }
      if (failure) throw failure
      if (!closed) controller.enqueue(chunk)
    },
    flush: detach
  })

  return {
    transform,
    follow(signal?: AbortSignal) {
      if (!signal || closed) return
      if (signal.aborted) {
        close()
        return
      }
      signal.addEventListener('abort', close, { once: true })
      signals.add(signal)
    },
    advance() {
      permits++
      resume?.()
    },
    open() {
      opened = true
      resume?.()
    },
    fail() {
      failure = new Error('Provider disconnected')
      detach()
      resume?.()
    },
    close
  }
}
