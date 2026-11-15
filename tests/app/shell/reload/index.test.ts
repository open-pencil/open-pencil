import { expect, test } from 'bun:test'

import { createDeferred } from '@/app/runtime/deferred'
import { announceReload, onBeforeReload } from '@/app/shell/reload'

test('an announced reload waits for every step, even after one fails', async () => {
  const told: boolean[] = []
  const slow = createDeferred<null>()
  const removals = [
    onBeforeReload(async ({ asks }) => {
      told.push(asks)
      throw new Error('Save failed')
    }),
    onBeforeReload(async ({ asks }) => {
      told.push(asks)
      await slow.promise
    })
  ]
  try {
    let settled = false
    const announced = (async () => {
      await announceReload({ asks: true })
      settled = true
    })()
    await Promise.resolve()
    expect(told).toEqual([true, true])
    expect(settled).toBe(false)
    slow.resolve(null)
    await announced
    expect(settled).toBe(true)
  } finally {
    for (const remove of removals) remove()
  }
})

test('a removed step no longer runs', async () => {
  let runs = 0
  const remove = onBeforeReload(async () => {
    runs++
  })
  remove()
  await announceReload({ asks: false })
  expect(runs).toBe(0)
})
