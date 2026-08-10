import { describe, expect, test } from 'bun:test'

import {
  forgetDevOpenFilePath,
  readDevOpenFilePath,
  rememberDevOpenFilePath,
  type FileRecoveryStorage
} from '@/app/tauri/dev-file-storage'

function createStorage(): FileRecoveryStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => {
      values.delete(key)
    }
  }
}

describe('development file recovery', () => {
  test('remembers and forgets the active desktop file path', () => {
    const storage = createStorage()

    expect(readDevOpenFilePath(storage)).toBeNull()
    rememberDevOpenFilePath('/tmp/design.fig', storage)
    expect(readDevOpenFilePath(storage)).toBe('/tmp/design.fig')
    forgetDevOpenFilePath(storage)
    expect(readDevOpenFilePath(storage)).toBeNull()
  })
})
