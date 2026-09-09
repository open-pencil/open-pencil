import { expect, test } from 'bun:test'

import { createCredentialAccessCheck } from '@/app/settings/credentials/preferences/access-check'

test('failed queries do not claim paused access and can be retried', async () => {
  let fails = true
  const state = createCredentialAccessCheck(async () => {
    if (fails) throw new Error('IPC unavailable')
    return false
  })
  await state.check()
  expect(state.checkFailed.value).toBe(true)
  expect(state.paused.value).toBe(false)
  fails = false
  await state.check()
  expect(state.checkFailed.value).toBe(false)
  expect(state.paused.value).toBe(false)
})

test('outdated or disposed queries cannot overwrite the latest state', async () => {
  const pending = Promise.withResolvers<boolean>()
  let calls = 0
  const state = createCredentialAccessCheck(() =>
    ++calls === 1 ? pending.promise : Promise.resolve(true)
  )
  const old = state.check()
  await state.check()
  pending.resolve(false)
  await old
  expect(state.paused.value).toBe(true)
  const next = Promise.withResolvers<boolean>()
  const disposed = createCredentialAccessCheck(() => next.promise)
  const checking = disposed.check()
  disposed.invalidate()
  next.resolve(true)
  await checking
  expect(disposed.paused.value).toBe(false)
})
