import { describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import { clearPersistedChat, readPersistedChat, writePersistedChat } from '@/app/ai/chat/storage'

class TestStorage implements Storage {
  #values = new Map<string, string>()

  get length() {
    return this.#values.size
  }

  clear() {
    this.#values.clear()
  }

  getItem(key: string) {
    return this.#values.get(key) ?? null
  }

  key(index: number) {
    return [...this.#values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.#values.delete(key)
  }

  setItem(key: string, value: string) {
    this.#values.set(key, value)
  }
}

describe('AI chat persistence', () => {
  test('round-trips complete messages including tool parts', () => {
    const storage = new TestStorage()
    const messages: UIMessage[] = [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Inspect the canvas' }] },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'find_nodes',
            toolCallId: 'call-1',
            state: 'output-available',
            input: { type: 'FRAME' },
            output: { total: 3 }
          }
        ]
      }
    ]

    writePersistedChat(messages, true, storage)

    expect(readPersistedChat(storage)).toMatchObject({
      version: 1,
      messages,
      interrupted: true
    })
  })

  test('clears the current conversation', () => {
    const storage = new TestStorage()
    writePersistedChat(
      [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      false,
      storage
    )
    clearPersistedChat(storage)
    expect(readPersistedChat(storage)).toBeNull()
  })
})
