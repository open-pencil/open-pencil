import { expect, test } from 'bun:test'

import { runCloudOperation, cloudOperationMessage } from '@/app/cloud/settings/operation'

test('Cloud UI outcomes do not expose exception details', async () => {
  const result = await runCloudOperation(async () => {
    throw new Error('private endpoint and credential details')
  })
  expect(result).toEqual({ ok: false, failure: 'unavailable' })
  if (result.ok) throw new Error('Expected failure')
  expect(cloudOperationMessage(result.failure)).toBe('statusConnectionErrorDescription')
})

test('successful Cloud operations expose a success outcome', async () => {
  expect(await runCloudOperation(async () => undefined)).toEqual({ ok: true })
})
