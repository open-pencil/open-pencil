import { describe, expect, jest, test } from 'bun:test'

import { nextTick, shallowRef } from 'vue'

import { createEditor } from '@open-pencil/core'

import { createEditorPreparationController } from '@/app/editor/preparation/controller'
import { createEditorPreparationEvents } from '@/app/editor/preparation/events'
import type { EditorPreparationResult } from '@/app/editor/preparation/types'
import { createInitialAppEditorState } from '@/app/editor/session/types'

/** Versions of a frame whose view and scene both reached `version`. */
const at = (version: number) => ({ renderVersion: version, sceneVersion: version })

describe('editor preparation controller', () => {
  test('keeps one reactive preparation snapshot until its owner finishes', () => {
    const state = createInitialAppEditorState('page')
    const controller = createEditorPreparationController(state)
    const load = controller.begin({ kind: 'document-open', subject: 'example.fig' })
    load.update({
      phase: 'resolving-fonts',
      detail: 'Geist Regular',
      completed: 2,
      total: 7,
      unit: 'fonts'
    })

    expect(state.preparation).toEqual({
      id: load.id,
      kind: 'document-open',
      phase: 'resolving-fonts',
      subject: 'example.fig',
      detail: 'Geist Regular',
      progress: { completed: 2, total: 7, unit: 'fonts' },
      startedAt: expect.any(Number)
    })

    load.complete()
    expect(state.preparation).toBeNull()
  })

  test('aborts and ignores an obsolete preparation handle', () => {
    const state = createInitialAppEditorState('page')
    const events = createEditorPreparationEvents()
    const results: EditorPreparationResult[] = []
    events.on('preparation:finished', (result) => results.push(result))
    const controller = createEditorPreparationController(state, events)
    const first = controller.begin({ kind: 'document-open' })
    const second = controller.begin({ kind: 'page-switch', phase: 'populating-page' })

    expect(first.signal.aborted).toBe(true)
    expect(results).toContainEqual({
      id: first.id,
      kind: 'document-open',
      status: 'cancelled',
      reason: 'superseded'
    })
    first.update({ phase: 'layout', detail: 'obsolete' })
    first.complete()
    expect(state.preparation?.id).toBe(second.id)
    second.complete()
    expect(state.preparation).toBeNull()
  })

  test('hears frames shown on the editor bus until disposed', async () => {
    const state = createInitialAppEditorState('page')
    const editor = createEditor()
    const controller = createEditorPreparationController(state, undefined, { editor })
    const first = controller.begin({ kind: 'page-switch' })
    const waiting = controller.waitForPresentation(first.id, at(3))
    editor.reportPresented(at(3))
    await waiting
    first.complete()

    controller.dispose()
    const second = controller.begin({ kind: 'page-switch' })
    let settled = false
    void controller.waitForPresentation(second.id, at(4)).finally(() => {
      settled = true
    })
    editor.reportPresented(at(4))
    await Promise.resolve()
    expect(settled).toBe(false)
  })

  test('waits for a frame of both the scene and the view, such as a fit after the page', async () => {
    const state = createInitialAppEditorState('page')
    const controller = createEditorPreparationController(state)
    const handle = controller.begin({ kind: 'page-switch' })

    let presented = false
    const waiting = controller
      .waitForPresentation(handle.id, { renderVersion: 9, sceneVersion: 7 })
      .then(() => {
        presented = true
        return presented
      })
    // The page's scene drawn at the view it had before the fit does not count.
    controller.acknowledgePresentation({ renderVersion: 8, sceneVersion: 7 })
    await Promise.resolve()
    expect(presented).toBe(false)

    controller.acknowledgePresentation({ renderVersion: 9, sceneVersion: 7 })
    await waiting
    expect(presented).toBe(true)
    handle.complete()
  })

  test('waits for the scene as well as the view, and for one frame that has both', async () => {
    const state = createInitialAppEditorState('page')
    const controller = createEditorPreparationController(state)
    const handle = controller.begin({ kind: 'page-switch' })

    let presented = false
    const waiting = controller
      .waitForPresentation(handle.id, { renderVersion: 9, sceneVersion: 7 })
      .then(() => {
        presented = true
        return presented
      })
    // The view without the scene, then the scene in an older view: neither frame has both.
    controller.acknowledgePresentation({ renderVersion: 9, sceneVersion: 6 })
    controller.acknowledgePresentation({ renderVersion: 8, sceneVersion: 7 })
    await Promise.resolve()
    expect(presented).toBe(false)

    controller.acknowledgePresentation({ renderVersion: 9, sceneVersion: 7 })
    await waiting
    expect(presented).toBe(true)
    handle.complete()
  })

  test('waits for the prepared scene to be presented before finishing', async () => {
    const state = createInitialAppEditorState('page')
    const controller = createEditorPreparationController(state)
    const handle = controller.begin({ kind: 'page-switch' })

    let presented = false
    const waiting = controller.waitForPresentation(handle.id, at(7)).then(() => {
      presented = true
      return presented
    })
    await Promise.resolve()
    expect(presented).toBe(false)

    controller.acknowledgePresentation(at(6))
    await Promise.resolve()
    expect(presented).toBe(false)

    controller.acknowledgePresentation(at(7))
    await waiting
    expect(presented).toBe(true)
    handle.complete()
  })
  test('times out when a committed scene is never presented', async () => {
    const state = createInitialAppEditorState('page')
    const controller = createEditorPreparationController(state, undefined, {
      presentationTimeoutMs: 1
    })
    const handle = controller.begin({ kind: 'page-switch' })
    controller.attachCanvas()

    await expect(controller.waitForPresentation(handle.id, at(7))).rejects.toHaveProperty(
      'message',
      'The operation was timed out'
    )
    handle.fail({ code: 'render-failed', message: 'Timed out', retryable: true })
    expect(state.preparation).toBeNull()
  })
  test('waits without a timeout while no canvas shows the document', async () => {
    jest.useFakeTimers()
    try {
      const state = createInitialAppEditorState('page')
      const controller = createEditorPreparationController(state, undefined, {
        presentationTimeoutMs: 100
      })
      const handle = controller.begin({ kind: 'page-switch' })
      let settled = false
      const waiting = controller.waitForPresentation(handle.id, at(7)).finally(() => {
        settled = true
      })
      // A tab opened in the background: nothing draws it, and that is not a failure.
      jest.advanceTimersByTime(1_000)
      await Promise.resolve()
      expect(settled).toBe(false)

      // Shown, it gets the usual time to draw; leaving it again pauses that.
      const detach = controller.attachCanvas()
      jest.advanceTimersByTime(50)
      detach()
      jest.advanceTimersByTime(1_000)
      await Promise.resolve()
      expect(settled).toBe(false)

      controller.attachCanvas()
      controller.acknowledgePresentation(at(7))
      await waiting
      handle.complete()
    } finally {
      jest.useRealTimers()
    }
  })

  test('fails the wait when the canvas cannot start, before or after it begins', async () => {
    const state = createInitialAppEditorState('page')
    const controller = createEditorPreparationController(state)
    const failure = new Error('The canvas could not start')

    const first = controller.begin({ kind: 'page-switch' })
    const waiting = controller.waitForPresentation(first.id, at(7))
    controller.failCanvas(failure)
    await expect(waiting).rejects.toBe(failure)
    first.fail({ code: 'render-failed', message: failure.message, retryable: true })

    const second = controller.begin({ kind: 'page-switch' })
    await expect(controller.waitForPresentation(second.id, at(8))).rejects.toBe(failure)
    second.fail({ code: 'render-failed', message: failure.message, retryable: true })

    // A canvas that starts later presents scenes again.
    controller.attachCanvas()
    const third = controller.begin({ kind: 'page-switch' })
    const presenting = controller.waitForPresentation(third.id, at(9))
    controller.acknowledgePresentation(at(9))
    await presenting
    third.complete()
  })

  test('fails the wait once the last working canvas leaves after another could not start', async () => {
    const state = createInitialAppEditorState('page')
    const controller = createEditorPreparationController(state)
    const failure = new Error('The canvas could not start')
    const handle = controller.begin({ kind: 'page-switch' })
    const detach = controller.attachCanvas()
    const waiting = controller.waitForPresentation(handle.id, at(7))
    // Another pane fails while this one still draws; then this one closes before presenting.
    controller.failCanvas(failure)
    detach()
    await expect(waiting).rejects.toBe(failure)
    handle.fail({ code: 'render-failed', message: failure.message, retryable: true })
  })

  test('counts the time a tab was shown toward the limit, across visits', async () => {
    jest.useFakeTimers()
    try {
      const state = createInitialAppEditorState('page')
      const controller = createEditorPreparationController(state, undefined, {
        presentationTimeoutMs: 100
      })
      const handle = controller.begin({ kind: 'page-switch' })
      let failure: unknown = null
      const waiting = controller.waitForPresentation(handle.id, at(7)).catch((error: unknown) => {
        failure = error
      })
      // Two visits of 60 ms each: the scene had longer than its 100 ms to draw.
      const detach = controller.attachCanvas()
      jest.advanceTimersByTime(60)
      detach()
      controller.attachCanvas()
      jest.advanceTimersByTime(60)
      await Promise.resolve()
      expect(failure).toHaveProperty('message', 'The operation was timed out')
      controller.acknowledgePresentation(at(7))
      await waiting
      handle.fail({ code: 'render-failed', message: 'Timed out', retryable: true })
    } finally {
      jest.useRealTimers()
    }
  })
  // A canvas in a browser tab that is hidden draws no frames: the scene waits to be presented
  // until the tab is shown, as it does in an editor tab in the background.
  test('pauses the limit while the browser hides the page, keeping the time it had', async () => {
    jest.useFakeTimers()
    try {
      const visibility = shallowRef<DocumentVisibilityState>('visible')
      const state = createInitialAppEditorState('page')
      const controller = createEditorPreparationController(state, undefined, {
        presentationTimeoutMs: 100,
        visibility
      })
      controller.attachCanvas()
      const handle = controller.begin({ kind: 'page-switch' })
      let failure: unknown = null
      const waiting = controller.waitForPresentation(handle.id, at(7)).catch((error: unknown) => {
        failure = error
      })
      jest.advanceTimersByTime(50)
      visibility.value = 'hidden'
      await nextTick()
      jest.advanceTimersByTime(1_000)
      await Promise.resolve()
      expect(failure).toBeNull()

      // Shown again, the scene has the 50 ms it had left, not a fresh limit.
      visibility.value = 'visible'
      await nextTick()
      jest.advanceTimersByTime(49)
      await Promise.resolve()
      expect(failure).toBeNull()
      jest.advanceTimersByTime(1)
      await waiting
      expect(failure).toHaveProperty('message', 'The operation was timed out')
      handle.fail({ code: 'render-failed', message: 'Timed out', retryable: true })
      controller.dispose()
    } finally {
      jest.useRealTimers()
    }
  })

  // Another pane's canvas failing does not fail a wait the working one can still present.
  test('keeps a hidden wait pending while a working canvas remains', async () => {
    const visibility = shallowRef<DocumentVisibilityState>('hidden')
    const state = createInitialAppEditorState('page')
    const controller = createEditorPreparationController(state, undefined, { visibility })
    controller.attachCanvas()
    controller.failCanvas(new Error('The canvas could not start'))
    const handle = controller.begin({ kind: 'page-switch' })
    let outcome = 'pending' as 'pending' | 'presented' | 'failed'
    const waiting = controller.waitForPresentation(handle.id, at(7)).then(
      () => (outcome = 'presented'),
      () => (outcome = 'failed')
    )
    await Promise.resolve()
    expect(outcome).toBe('pending')
    controller.acknowledgePresentation(at(7))
    await waiting
    expect(outcome).toBe('presented')
    handle.complete()
    controller.dispose()
  })

  test('emits exactly one terminal outcome', () => {
    const state = createInitialAppEditorState('page')
    const events = createEditorPreparationEvents()
    const outcomes: string[] = []
    events.on('preparation:finished', (result) => outcomes.push(result.status))
    events.on('preparation:failed', () => outcomes.push('failed'))
    const controller = createEditorPreparationController(state, events)

    const failed = controller.begin({ kind: 'document-open' })
    failed.fail({ code: 'decode-failed', message: 'Invalid', retryable: false })
    failed.complete()
    failed.cancel()

    expect(outcomes).toEqual(['failed'])
  })
  test('dispose aborts the active tab-local preparation', () => {
    const state = createInitialAppEditorState('page')
    const controller = createEditorPreparationController(state)
    const load = controller.begin({ kind: 'storage-open' })

    controller.dispose()

    expect(load.signal.aborted).toBe(true)
    expect(state.preparation).toBeNull()
  })
})
