import { expect, test } from 'bun:test'

import { createExitApproval } from '@/app/document/close/exit'

const noUnsavedDocuments = () => false

test('concurrent confirmations share one prompt run', async () => {
  let prompts = 0
  const approval = createExitApproval(async () => {
    prompts++
    await Promise.resolve()
    return true
  }, noUnsavedDocuments)

  const results = await Promise.all([approval.confirm(), approval.confirm(), approval.confirm()])

  expect(results).toEqual([true, true, true])
  expect(prompts).toBe(1)
  expect(approval.isApproved()).toBe(true)
})

test('a cancelled confirmation clears so the next request prompts again', async () => {
  let prompts = 0
  const approval = createExitApproval(async () => {
    prompts++
    return prompts > 1
  }, noUnsavedDocuments)

  expect(await approval.confirm()).toBe(false)
  expect(approval.isApproved()).toBe(false)
  expect(await approval.confirm()).toBe(true)
  expect(prompts).toBe(2)

  // Once approved, later requests never prompt.
  expect(await approval.confirm()).toBe(true)
  expect(prompts).toBe(2)
})

test('a failed confirmation retries instead of caching the rejection', async () => {
  let attempts = 0
  const approval = createExitApproval(async () => {
    attempts++
    if (attempts === 1) throw new Error('Write failed')
    return true
  }, noUnsavedDocuments)

  await expect(approval.confirm()).rejects.toThrow('Write failed')
  expect(approval.isApproved()).toBe(false)
  expect(await approval.confirm()).toBe(true)
  expect(attempts).toBe(2)
})

test('leaving asks first only while a document is unsaved and exit is not approved', async () => {
  let unsaved = false
  const approval = createExitApproval(
    async () => true,
    () => unsaved
  )

  expect(approval.asksBeforeLeaving()).toBe(false)
  unsaved = true
  expect(approval.asksBeforeLeaving()).toBe(true)
  await approval.confirm()
  expect(approval.asksBeforeLeaving()).toBe(false)
})
