import { useDocumentVisibility } from '@vueuse/core'
import { TimeoutError } from 'es-toolkit/error'
import { watch, type Ref } from 'vue'

import type { Editor, RenderVersions } from '@open-pencil/core'

import type { EditorPreparationEventEmitter } from '@/app/editor/preparation/events'
import type {
  BeginEditorPreparation,
  EditorPreparationCancelReason,
  EditorPreparationFailure,
  EditorPreparationHandle,
  EditorPreparationUpdate
} from '@/app/editor/preparation/types'
import type { AppEditorState } from '@/app/editor/session/types'

const PRESENTATION_TIMEOUT_MS = 10_000

/** Whether the browser shows the page, for every editor; a hidden tab draws no frames. */
const documentVisibility = useDocumentVisibility()

interface PresentationWaiter {
  versions: RenderVersions
  resolve: () => void
  reject: (error: Error) => void
  /**
   * Runs only while a canvas shows the document, which is the only place it is presented, and
   * the browser tab is shown: a hidden tab draws nothing.
   */
  timer: ReturnType<typeof setTimeout> | null
  /** When the timer last started, so pausing it keeps the time it already had. */
  startedAt: number
  /** The time left to draw the scene while shown. */
  remainingMs: number
}

export interface EditorPreparationControllerOptions {
  presentationTimeoutMs?: number
  /** The editor whose canvases report frames shown, through `render:presented`. */
  editor?: Pick<Editor, 'onEditorEvent'>
  /** Whether the browser shows the page; the document's own by default. */
  visibility?: Readonly<Ref<DocumentVisibilityState>>
}

export interface EditorPreparationController {
  begin(options: BeginEditorPreparation): EditorPreparationHandle
  /** A frame of these versions is fully shown; `render:presented` reports it from canvases. */
  acknowledgePresentation(versions: RenderVersions): void
  /**
   * Resolves once a frame at least as new as `versions` in both is fully drawn. The versions are
   * read when called, so an editor's live state can be passed.
   */
  waitForPresentation(id: number, versions: RenderVersions): Promise<void>
  /**
   * A canvas started showing the document; returns its detach. A tab in the background has no
   * canvas, so its scene waits to be presented until the tab is shown, without timing out.
   */
  attachCanvas(): () => void
  /**
   * A canvas could not start, so nothing presents the scene until one attaches: waiting for it
   * fails with this error rather than waiting with no time limit.
   */
  failCanvas(error: Error): void
  dispose(): void
}

export function createEditorPreparationController(
  state: AppEditorState,
  events?: EditorPreparationEventEmitter,
  options: EditorPreparationControllerOptions = {}
): EditorPreparationController {
  const presentationTimeoutMs = options.presentationTimeoutMs ?? PRESENTATION_TIMEOUT_MS
  let nextId = 0
  let activeAbort: AbortController | null = null
  let activeCancel: ((reason: EditorPreparationCancelReason) => void) | null = null
  /** The newest frame shown; its two versions came together, so one frame meets a wait. */
  let presented: RenderVersions = { renderVersion: -1, sceneVersion: -1 }
  const covers = (frame: RenderVersions, versions: RenderVersions) =>
    frame.renderVersion >= versions.renderVersion && frame.sceneVersion >= versions.sceneVersion
  let canvases = 0
  let canvasFailure: Error | null = null
  const presentationWaiters = new Map<number, PresentationWaiter>()
  // A hidden tab draws no frames, so presents nothing: the limit runs only while it is shown.
  const visibility = options.visibility ?? documentVisibility
  const timing = () => canvases > 0 && visibility.value !== 'hidden'
  const stopVisibility = watch(visibility, () => {
    for (const [id, waiter] of presentationWaiters) {
      if (timing()) startTimer(id, waiter)
      else pauseTimer(waiter)
    }
  })

  function settle(id: number, outcome: Error | null) {
    const waiter = presentationWaiters.get(id)
    if (!waiter) return
    presentationWaiters.delete(id)
    if (waiter.timer !== null) clearTimeout(waiter.timer)
    if (outcome) waiter.reject(outcome)
    else waiter.resolve()
  }

  function startTimer(id: number, waiter: PresentationWaiter) {
    if (waiter.timer !== null) return
    waiter.startedAt = Date.now()
    waiter.timer = setTimeout(() => settle(id, new TimeoutError()), waiter.remainingMs)
  }

  function pauseTimer(waiter: PresentationWaiter) {
    if (waiter.timer === null) return
    clearTimeout(waiter.timer)
    waiter.timer = null
    waiter.remainingMs = Math.max(0, waiter.remainingMs - (Date.now() - waiter.startedAt))
  }

  const isActive = (id: number) => state.preparation?.id === id

  function acknowledgePresentation(versions: RenderVersions) {
    presented = { renderVersion: versions.renderVersion, sceneVersion: versions.sceneVersion }
    for (const [id, waiter] of presentationWaiters) {
      if (covers(presented, waiter.versions)) settle(id, null)
    }
  }

  const stopPresentations = options.editor?.onEditorEvent(
    'render:presented',
    acknowledgePresentation
  )

  return {
    begin(options) {
      activeCancel?.('superseded')
      const abort = new AbortController()
      activeAbort = abort
      const id = ++nextId
      const kind = options.kind
      state.preparation = {
        id,
        kind,
        phase: options.phase ?? 'reading',
        subject: options.subject ?? null,
        detail: null,
        progress: null,
        startedAt: performance.now()
      }
      events?.emit('preparation:started', state.preparation)

      const clear = () => {
        settle(id, null)
        if (isActive(id)) state.preparation = null
        if (activeAbort === abort) activeAbort = null
        if (activeCancel === cancel) activeCancel = null
      }

      const cancel = (reason: EditorPreparationCancelReason = 'user') => {
        if (!isActive(id)) return
        abort.abort()
        clear()
        events?.emit('preparation:finished', { id, kind, status: 'cancelled', reason })
      }
      activeCancel = cancel

      return {
        id,
        signal: abort.signal,
        update(update: EditorPreparationUpdate) {
          if (!isActive(id) || abort.signal.aborted) return
          const hasProgress =
            update.completed !== undefined &&
            update.completed !== null &&
            update.total !== undefined &&
            update.total !== null &&
            update.total > 0
          const previous = state.preparation
          if (!previous) return
          state.preparation = {
            ...previous,
            phase: update.phase,
            detail: update.detail ?? null,
            progress: hasProgress
              ? {
                  completed: update.completed ?? 0,
                  total: update.total ?? 0,
                  unit: update.unit ?? 'fonts'
                }
              : null
          }
          events?.emit('preparation:updated', state.preparation, previous)
        },
        complete() {
          if (!isActive(id)) return
          clear()
          events?.emit('preparation:finished', { id, kind, status: 'completed' })
        },
        fail(failure) {
          if (!isActive(id)) return
          const event: EditorPreparationFailure = { id, kind, ...failure }
          clear()
          events?.emit('preparation:failed', event)
        },
        cancel
      }
    },
    acknowledgePresentation,
    waitForPresentation(id, versions) {
      if (!isActive(id) || covers(presented, versions)) return Promise.resolve()
      settle(id, null)
      return new Promise<void>((resolve, reject) => {
        const waiter: PresentationWaiter = {
          versions: { renderVersion: versions.renderVersion, sceneVersion: versions.sceneVersion },
          resolve,
          reject,
          timer: null,
          startedAt: 0,
          remainingMs: presentationTimeoutMs
        }
        presentationWaiters.set(id, waiter)
        // A failed canvas fails the wait only when no other canvas can present the scene.
        if (canvases > 0) {
          if (timing()) startTimer(id, waiter)
        } else if (canvasFailure) settle(id, canvasFailure)
      })
    },
    attachCanvas() {
      canvases += 1
      canvasFailure = null
      if (timing()) for (const [id, waiter] of presentationWaiters) startTimer(id, waiter)
      let attached = true
      return () => {
        if (!attached) return
        attached = false
        canvases -= 1
        if (canvases > 0) return
        if (canvasFailure) {
          for (const id of presentationWaiters.keys()) settle(id, canvasFailure)
          return
        }
        for (const waiter of presentationWaiters.values()) pauseTimer(waiter)
      }
    },
    failCanvas(error) {
      canvasFailure = error
      if (canvases > 0) return
      for (const id of presentationWaiters.keys()) settle(id, error)
    },
    dispose() {
      stopVisibility()
      stopPresentations?.()
      activeCancel?.('tab-closed')
      activeAbort?.abort()
      activeAbort = null
      activeCancel = null
      for (const id of presentationWaiters.keys()) settle(id, null)
      state.preparation = null
    }
  }
}
