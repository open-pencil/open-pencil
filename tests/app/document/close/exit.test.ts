import { expect, test } from 'bun:test'

import { createExitApproval } from '@/app/document/close/exit'

test('concurrent confirmations share one prompt run', async () => {
  let prompts = 0
  const approval = createExitApproval(async () => {
    prompts++
    await Promise.resolve()
    return true
  })

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
  })

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
  })

  await expect(approval.confirm()).rejects.toThrow('Write failed')
  expect(approval.isApproved()).toBe(false)
  expect(await approval.confirm()).toBe(true)
  expect(attempts).toBe(2)
})
