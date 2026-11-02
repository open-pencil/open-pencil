import { describe, expect, jest, test } from 'bun:test'

import { createEditorPreparationController } from '@/app/editor/preparation/controller'
import { createEditorPreparationEvents } from '@/app/editor/preparation/events'
import type { EditorPreparationResult } from '@/app/editor/preparation/types'
import { createInitialAppEditorState } from '@/app/editor/session/types'

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

  test('waits for the prepared scene to be presented before finishing', async () => {
    const state = createInitialAppEditorState('page')
    const controller = createEditorPreparationController(state)
    const handle = controller.begin({ kind: 'page-switch' })

    let presented = false
    const waiting = controller.waitForPresentation(handle.id, 7).then(() => {
      presented = true
      return presented
    })
    await Promise.resolve()
    expect(presented).toBe(false)

    controller.acknowledgePresentation(6)
    await Promise.resolve()
    expect(presented).toBe(false)

    controller.acknowledgePresentation(7)
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

    await expect(controller.waitForPresentation(handle.id, 7)).rejects.toHaveProperty(
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
      const waiting = controller.waitForPresentation(handle.id, 7).finally(() => {
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
      controller.acknowledgePresentation(7)
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
    const waiting = controller.waitForPresentation(first.id, 7)
    controller.failCanvas(failure)
    await expect(waiting).rejects.toBe(failure)
    first.fail({ code: 'render-failed', message: failure.message, retryable: true })

    const second = controller.begin({ kind: 'page-switch' })
    await expect(controller.waitForPresentation(second.id, 8)).rejects.toBe(failure)
    second.fail({ code: 'render-failed', message: failure.message, retryable: true })

    // A canvas that starts later presents scenes again.
    controller.attachCanvas()
    const third = controller.begin({ kind: 'page-switch' })
    const presenting = controller.waitForPresentation(third.id, 9)
    controller.acknowledgePresentation(9)
    await presenting
    third.complete()
  })

  test('fails the wait once the last working canvas leaves after another could not start', async () => {
    const state = createInitialAppEditorState('page')
    const controller = createEditorPreparationController(state)
    const failure = new Error('The canvas could not start')
    const handle = controller.begin({ kind: 'page-switch' })
    const detach = controller.attachCanvas()
    const waiting = controller.waitForPresentation(handle.id, 7)
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
      const waiting = controller.waitForPresentation(handle.id, 7).catch((error: unknown) => {
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
      controller.acknowledgePresentation(7)
      await waiting
      handle.fail({ code: 'render-failed', message: 'Timed out', retryable: true })
    } finally {
      jest.useRealTimers()
    }
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
