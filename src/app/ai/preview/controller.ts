import { noop, useDebounceFn, useEventListener } from '@vueuse/core'

import { createStreamingJSXParser, type JSXPreviewNode } from '@open-pencil/design-jsx'

import { readPreviewInput, type RenderPreviewInput } from './input'

const PREVIEW_INTERVAL_MS = 120
const MAX_INPUT_LENGTH = 256_000
const MAX_PREVIEW_CALLS = 4

export interface PreviewArtifact {
  show(): void
  dispose(): void
}

interface PreviewDependencies<Target> {
  onIdle?(): void
  capture(): Target | null
  isCurrent(target: Target): boolean
  build(
    target: Target,
    tree: JSXPreviewNode,
    input: RenderPreviewInput,
    signal: AbortSignal
  ): Promise<PreviewArtifact | null>
}

interface PreviewCall<Target> {
  target: Target
  input: string
  jsx: string
  parser: ReturnType<typeof createStreamingJSXParser>
  revision: number
  busy: boolean
  /** Coalesces deltas into at most one preview per interval. */
  schedule(): void
  abort: AbortController
  stopAbortListener(): void
  artifact?: PreviewArtifact
}

/** Owns one bounded set of speculative tool calls. Never waits for rendering in a model callback. */
export function createJSXPreviewController<Target>(deps: PreviewDependencies<Target>) {
  const calls = new Map<string, PreviewCall<Target>>()

  function finish(id: string): void {
    const call = calls.get(id)
    if (!call) return
    calls.delete(id)
    call.abort.abort()
    call.stopAbortListener()
    call.artifact?.dispose()
    if (calls.size === 0) deps.onIdle?.()
  }

  function clear(): void {
    for (const id of calls.keys()) finish(id)
  }

  /** The document changed under the previews: drop what they show and rebuild, keeping the calls. */
  function invalidate(): void {
    for (const call of calls.values()) {
      call.artifact?.dispose()
      call.artifact = undefined
      call.revision++
      if (!call.busy) call.schedule()
    }
  }

  function start(id: string, signal?: AbortSignal): void {
    finish(id)
    if (signal?.aborted || calls.size >= MAX_PREVIEW_CALLS) return
    const target = deps.capture()
    if (!target) return
    // Trailing with a cap: a lone delta still flushes, and a burst flushes once per interval.
    const scheduledFlush = useDebounceFn(() => flush(id), PREVIEW_INTERVAL_MS, {
      maxWait: PREVIEW_INTERVAL_MS
    })
    calls.set(id, {
      target,
      input: '',
      jsx: '',
      parser: createStreamingJSXParser(),
      revision: 0,
      busy: false,
      schedule: () => void scheduledFlush(),
      abort: new AbortController(),
      stopAbortListener: signal
        ? useEventListener(signal, 'abort', () => finish(id), { once: true })
        : noop
    })
  }

  function delta(id: string, chunk: string): void {
    const call = calls.get(id)
    if (!call) return
    if (!deps.isCurrent(call.target) || call.input.length + chunk.length > MAX_INPUT_LENGTH) {
      finish(id)
      return
    }
    call.input += chunk
    call.revision++
    if (!call.busy) call.schedule()
  }

  async function flush(id: string): Promise<void> {
    const call = calls.get(id)
    if (!call || call.busy) return
    if (!deps.isCurrent(call.target)) {
      finish(id)
      return
    }
    const input = readPreviewInput(call.input)
    if (!input) return
    const revision = call.revision
    call.busy = true
    try {
      // Partial JSON decoders may revise an incomplete escape; reset only when not append-only.
      if (!input.jsx.startsWith(call.jsx)) {
        call.parser.reset()
        call.jsx = ''
      }
      const snapshot = call.parser.append(input.jsx.slice(call.jsx.length))
      call.jsx = input.jsx
      if (!snapshot.tree) return
      const artifact = await deps.build(call.target, snapshot.tree, input, call.abort.signal)
      if (!artifact) return
      // A newer revision still shows this artifact; `finally` renders the newer one next.
      if (calls.get(id) !== call || call.abort.signal.aborted || !deps.isCurrent(call.target)) {
        artifact.dispose()
        return
      }
      call.artifact?.dispose()
      call.artifact = artifact
      artifact.show()
    } catch {
      // Disable this speculative call; authoritative execution still reports any actual error.
      finish(id)
    } finally {
      call.busy = false
      if (calls.get(id) === call && revision !== call.revision) call.schedule()
    }
  }

  return { start, delta, finish, clear, invalidate, flush }
}
