import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { HarnessResumeState } from '../src/backends/types'
import { FileResumeStateStore } from '../src/session-store'

const state: HarnessResumeState = {
  type: 'resume-session',
  harnessId: 'fake',
  specificationVersion: 'harness-v1',
  data: { opaque: 'state' }
}

describe('FileResumeStateStore', () => {
  test('atomically persists and removes opaque state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'open-pencil-harness-'))
    try {
      const store = new FileResumeStateStore(root)
      expect(await store.load('session-1')).toBeUndefined()
      await store.save('session-1', state)
      expect(await store.load('session-1')).toEqual(state)
      expect(JSON.parse(await readFile(join(root, 'session-1.json'), 'utf8'))).toEqual(state)
      await store.remove('session-1')
      expect(await store.load('session-1')).toBeUndefined()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('concurrent saves leave valid state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'open-pencil-harness-'))
    try {
      const store = new FileResumeStateStore(root)
      await Promise.all([
        store.save('session-1', state),
        store.save('session-1', { ...state, data: { opaque: 'newer' } })
      ])
      expect(await store.load('session-1')).toMatchObject({
        type: 'resume-session',
        harnessId: 'fake'
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects path traversal session IDs', async () => {
    const store = new FileResumeStateStore(tmpdir())
    await expect(store.save('../escape', state)).rejects.toThrow('Invalid harness session ID')
  })
})
