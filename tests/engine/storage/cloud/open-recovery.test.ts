import { expect, test } from 'bun:test'

import { createStorageOpenRecovery } from '@/app/tabs/open/recovery'

const target = {
  document: { id: 'document', name: 'Design', updatedAt: '' },
  binding: {
    providerId: 'openpencil-cloud' as const,
    connectionId: 'owner',
    workspaceId: 'workspace',
    documentId: 'document'
  }
}

test('failed opening retains a copied binding and retries that owner', async () => {
  const recovery = createStorageOpenRecovery()
  const input = structuredClone(target)
  recovery.failed(input)
  input.binding.connectionId = 'other'
  await recovery.retry(async (captured) => {
    expect(captured.binding.connectionId).toBe('owner')
    throw new Error('Offline')
  })
  expect(recovery.target.value?.binding.connectionId).toBe('owner')
  await recovery.retry(async () => undefined)
  expect(recovery.target.value).toBeNull()
})

test('opening an unrelated document does not dismiss recovery', () => {
  const recovery = createStorageOpenRecovery()
  recovery.failed(target)
  recovery.opened({ ...target.binding, connectionId: 'other' })
  expect(recovery.target.value).not.toBeNull()
  recovery.opened(target.binding)
  expect(recovery.target.value).toBeNull()
})
