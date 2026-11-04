import { describe, expect, test } from 'bun:test'

import { copyAndDeleteSelection } from '@/app/shell/keyboard/clipboard'

function storeWithCopyResult(result: Promise<void>) {
  let deleted = false
  return {
    clipboard: {
      copy: async () => {
        await result
        return true
      },
      paste: async () => false
    },
    store: {
      state: { selectedIds: new Set<string>() },
      deleteSelected: () => {
        deleted = true
      }
    },
    wasDeleted: () => deleted
  }
}

describe('browser keyboard clipboard cut', () => {
  test('deletes only after clipboard data is written', async () => {
    const { store, clipboard, wasDeleted } = storeWithCopyResult(Promise.resolve())
    expect(await copyAndDeleteSelection(store as never, clipboard)).toBe(true)
    expect(wasDeleted()).toBe(true)
  })

  test('preserves selection when clipboard serialization fails', async () => {
    const { store, clipboard, wasDeleted } = storeWithCopyResult(
      Promise.reject(new Error('copy failed'))
    )
    expect(await copyAndDeleteSelection(store as never, clipboard)).toBe(false)
    expect(wasDeleted()).toBe(false)
  })
})
