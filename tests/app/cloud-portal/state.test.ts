import { describe, expect, test } from 'bun:test'

import { effectScope, nextTick } from 'vue'

import { usePortalLoad } from '@/app/cloud-portal/state'

/** A load the test answers by hand, one request at a time. */
function pending() {
  let answer: (value: string) => void = () => undefined
  let refuse: (error: Error) => void = () => undefined
  const promise = new Promise<string>((resolve, reject) => {
    answer = resolve
    refuse = reject
  })
  return { promise, answer, refuse }
}

async function settle() {
  await nextTick()
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

describe('usePortalLoad', () => {
  test('tells a first load from a refresh, which keeps the value shown', async () => {
    const requests: ReturnType<typeof pending>[] = []
    const scope = effectScope(true)
    const load = scope.run(() =>
      usePortalLoad(() => {
        const request = pending()
        requests.push(request)
        return request.promise
      }, '')
    )
    if (!load) throw new Error('The load did not start')
    try {
      expect(load.status.value).toBe('loading')
      requests[0]?.answer('first')
      await settle()
      expect(load.status.value).toBe('ready')
      expect(load.data.value).toBe('first')

      const reloaded = load.reload()
      expect(load.status.value).toBe('refreshing')
      expect(load.data.value).toBe('first')
      requests[1]?.answer('second')
      await reloaded
      expect(load.status.value).toBe('ready')
      expect(load.data.value).toBe('second')

      // A failed refresh still has the last value to show.
      const failed = load.reload()
      requests[2]?.refuse(new Error('offline'))
      await failed
      expect(load.status.value).toBe('ready')
      expect(load.error.value).not.toBeNull()
      expect(load.data.value).toBe('second')
    } finally {
      scope.stop()
    }
  })

  test('counts only the newest request, as for its value', async () => {
    const requests: ReturnType<typeof pending>[] = []
    const scope = effectScope(true)
    const load = scope.run(() =>
      usePortalLoad(() => {
        const request = pending()
        requests.push(request)
        return request.promise
      }, '')
    )
    if (!load) throw new Error('The load did not start')
    try {
      // The page asks again before its first answer, which then arrives after the second failed.
      const again = load.reload()
      requests[1]?.refuse(new Error('offline'))
      await again
      requests[0]?.answer('stale')
      await settle()
      expect(load.status.value).toBe('failed')
      expect(load.data.value).toBe('')
    } finally {
      scope.stop()
    }
  })

  test('fails when nothing has loaded yet', async () => {
    const scope = effectScope(true)
    const load = scope.run(() => usePortalLoad(() => Promise.reject(new Error('offline')), ''))
    if (!load) throw new Error('The load did not start')
    try {
      await settle()
      expect(load.status.value).toBe('failed')
      expect(load.error.value).not.toBeNull()
    } finally {
      scope.stop()
    }
  })
})
