import { expect, spyOn, test } from 'bun:test'

import { effectScope } from 'vue'

import { diagnostics, type DiagnosticEvent } from '@/app/diagnostics'
import { useRecentDiagnostics } from '@/app/diagnostics/settings/recent'

test('recent diagnostics unsubscribes and ignores an outstanding refresh after disposal', async () => {
  let resolveEvents: (events: DiagnosticEvent[]) => void = () => undefined
  let unsubscribed = false
  const listing = spyOn(diagnostics, 'list').mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveEvents = resolve
      })
  )
  const subscription = spyOn(diagnostics, 'subscribe').mockImplementation(() => () => {
    unsubscribed = true
  })
  const scope = effectScope()
  try {
    const state = scope.run(() =>
      useRecentDiagnostics(
        () => {
          throw new Error('Disposed refresh must not project')
        },
        async () => undefined
      )
    )
    scope.stop()
    resolveEvents([])
    await Promise.resolve()
    expect(unsubscribed).toBe(true)
    expect(state?.recentEvents.value).toEqual([])
  } finally {
    scope.stop()
    listing.mockRestore()
    subscription.mockRestore()
  }
})
