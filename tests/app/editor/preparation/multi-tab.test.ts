import { describe, expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session/create'

describe('multi-tab editor preparation', () => {
  test('keeps preparation snapshots isolated per editor store', () => {
    const first = createEditorStore()
    const second = createEditorStore()
    const events: string[] = []
    const offStarted = first.onPreparationEvent('preparation:started', () => events.push('started'))
    const offUpdated = first.onPreparationEvent('preparation:updated', () => events.push('updated'))
    const offFinished = first.onPreparationEvent('preparation:finished', (result) =>
      events.push(result.status)
    )
    const firstLoad = first.preparationController.begin({
      kind: 'document-open',
      subject: 'first.fig'
    })
    const secondLoad = second.preparationController.begin({
      kind: 'storage-open',
      subject: 'second.fig'
    })

    expect(first.state.preparation?.subject).toBe('first.fig')
    expect(second.state.preparation?.subject).toBe('second.fig')
    firstLoad.update({ phase: 'layout' })
    firstLoad.complete()
    expect(events).toEqual(['started', 'updated', 'completed'])
    offStarted()
    offUpdated()
    offFinished()
    expect(first.state.preparation).toBeNull()
    expect(second.state.preparation?.id).toBe(secondLoad.id)

    first.dispose()
    second.dispose()
  })

  test('disposing one editor aborts only its own active preparation', () => {
    const first = createEditorStore()
    const second = createEditorStore()
    const firstLoad = first.preparationController.begin({ kind: 'page-switch' })
    const secondLoad = second.preparationController.begin({ kind: 'font-retry' })

    first.dispose()

    expect(firstLoad.signal.aborted).toBe(true)
    expect(first.state.preparation).toBeNull()
    expect(secondLoad.signal.aborted).toBe(false)
    expect(second.state.preparation).not.toBeNull()
    second.dispose()
  })
})
