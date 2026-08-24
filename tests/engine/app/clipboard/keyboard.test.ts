import { describe, expect, test } from 'bun:test'

import { copyAndDeleteSelection } from '@/app/shell/keyboard/clipboard'

function storeWithCopyResult(result: Promise<void>) {
  let deleted = false
  return {
    store: {
      writeCopyData: () => result,
      deleteSelected: () => {
        deleted = true
      }
    },
    wasDeleted: () => deleted
  }
}

describe('browser keyboard clipboard cut', () => {
  test('deletes only after clipboard data is written', async () => {
    const { store, wasDeleted } = storeWithCopyResult(Promise.resolve())
    expect(await copyAndDeleteSelection(store as never, {} as DataTransfer)).toBe(true)
    expect(wasDeleted()).toBe(true)
  })

  test('preserves selection when clipboard serialization fails', async () => {
    const { store, wasDeleted } = storeWithCopyResult(Promise.reject(new Error('copy failed')))
    expect(await copyAndDeleteSelection(store as never, {} as DataTransfer)).toBe(false)
    expect(wasDeleted()).toBe(false)
  })
})
