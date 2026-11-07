import { describe, expect, test } from 'bun:test'

import { claimChunkReload, reloadOnceOnChunkError } from '@/app/shell/support/chunk-reload'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value)
  }
}

function preloadError(target: EventTarget): Event {
  const event = new Event('vite:preloadError', { cancelable: true })
  target.dispatchEvent(event)
  return event
}

describe('claiming a reload for a missing chunk', () => {
  test('is granted once per minute', () => {
    const storage = memoryStorage()
    expect(claimChunkReload(storage, 1_000)).toBe(true)
    expect(claimChunkReload(storage, 30_000)).toBe(false)
    expect(claimChunkReload(storage, 61_001)).toBe(true)
  })

  test('is granted when the recorded reload is ahead of the clock', () => {
    const storage = memoryStorage({ 'openpencil:chunk-reload-at': '500000' })
    expect(claimChunkReload(storage, 1_000)).toBe(true)
    expect(claimChunkReload(storage, 2_000)).toBe(false)
  })

  test('is refused when the page cannot remember it reloaded', () => {
    expect(claimChunkReload(null, 1_000)).toBe(false)
    const failing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => undefined
    }
    expect(claimChunkReload(failing, 1_000)).toBe(false)
  })
})

describe('a lazy chunk that fails to load', () => {
  test('reloads the page and keeps Vite from throwing the error', () => {
    const target = new EventTarget()
    let reloads = 0
    reloadOnceOnChunkError({ target, storage: memoryStorage(), reload: () => reloads++ })
    expect(preloadError(target).defaultPrevented).toBe(true)
    expect(reloads).toBe(1)
  })

  test('reloads only once, then lets the error through', () => {
    const target = new EventTarget()
    const storage = memoryStorage()
    let reloads = 0
    reloadOnceOnChunkError({ target, storage, reload: () => reloads++, now: () => 5_000 })
    preloadError(target)
    expect(preloadError(target).defaultPrevented).toBe(false)
    expect(reloads).toBe(1)
  })

  test('does not reload without somewhere to remember it', () => {
    const target = new EventTarget()
    let reloads = 0
    reloadOnceOnChunkError({ target, storage: null, reload: () => reloads++ })
    expect(preloadError(target).defaultPrevented).toBe(false)
    expect(reloads).toBe(0)
  })
})
