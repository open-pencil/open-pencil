import { describe, expect, test } from 'bun:test'

import type {
  BackendEvent,
  BackendSession,
  HarnessBackend,
  HarnessResumeState
} from '../src/backends/types'
import type { HarnessSessionConfiguration } from '../src/protocol'
import { HarnessSessionService } from '../src/service'
import type { ResumeStateStore } from '../src/session-store'

const configuration: HarnessSessionConfiguration = {
  adapter: 'pi',
  sandbox: 'just-bash',
  model: 'test/model'
}

class MemoryStore implements ResumeStateStore {
  readonly states = new Map<string, HarnessResumeState>()

  async load(sessionId: string): Promise<HarnessResumeState | undefined> {
    return this.states.get(sessionId)
  }

  async save(sessionId: string, state: HarnessResumeState): Promise<void> {
    this.states.set(sessionId, state)
  }

  async remove(sessionId: string): Promise<void> {
    this.states.delete(sessionId)
  }
}

class FakeSession implements BackendSession {
  readonly isResume: boolean
  destroyed = false

  constructor(
    readonly sessionId: string,
    isResume: boolean
  ) {
    this.isResume = isResume
  }

  async *runTurn(prompt: string): AsyncIterable<BackendEvent> {
    yield { type: 'text-delta', text: `reply:${prompt}` }
    yield { type: 'finish', finishReason: 'stop' }
  }

  async stop(): Promise<HarnessResumeState> {
    return {
      type: 'resume-session',
      harnessId: 'pi',
      specificationVersion: 'harness-v1',
      data: { sessionId: this.sessionId }
    }
  }

  async destroy(): Promise<void> {
    this.destroyed = true
  }
}

class FakeBackend implements HarnessBackend {
  readonly id = 'pi' as const
  readonly capabilities = {
    adapter: 'pi',
    sandboxes: ['just-bash'],
    structuredOutput: false,
    sessionResume: 'live-process',
    turnContinuation: true
  } as const
  sessions: FakeSession[] = []

  async createSession(options: {
    sessionId: string
    resumeState?: HarnessResumeState
    configuration?: HarnessSessionConfiguration
  }): Promise<BackendSession> {
    const session = new FakeSession(options.sessionId, options.resumeState !== undefined)
    this.sessions.push(session)
    return session
  }
}

describe('HarnessSessionService', () => {
  test('reports adapter and sandbox capabilities', () => {
    const backend = new FakeBackend()
    const service = new HarnessSessionService(new Map([[backend.id, backend]]), new MemoryStore())
    expect(service.capabilities()).toEqual([
      {
        adapter: 'pi',
        sandboxes: ['just-bash'],
        structuredOutput: false,
        sessionResume: 'live-process',
        turnContinuation: true
      }
    ])
  })

  test('streams turns and resumes from opaque persisted state', async () => {
    const backend = new FakeBackend()
    const store = new MemoryStore()
    const service = new HarnessSessionService(new Map([[backend.id, backend]]), store)

    expect(await service.createSession('session-1', configuration)).toEqual({ isResume: false })
    const events: BackendEvent[] = []
    for await (const event of service.runTurn('session-1', 'hello')) events.push(event)
    expect(events).toEqual([
      { type: 'text-delta', text: 'reply:hello' },
      { type: 'finish', finishReason: 'stop' }
    ])

    await service.stopSession('session-1')
    expect(store.states.get('session-1')?.data).toEqual({ sessionId: 'session-1' })
    expect(await service.createSession('session-1', configuration)).toEqual({ isResume: true })
  })

  test('destroys a session and removes resumability', async () => {
    const backend = new FakeBackend()
    const store = new MemoryStore()
    const service = new HarnessSessionService(new Map([[backend.id, backend]]), store)
    await service.createSession('session-1', configuration)
    await service.stopSession('session-1')
    await service.createSession('session-1', configuration)
    await service.destroySession('session-1')

    expect(store.states.has('session-1')).toBeFalse()
    expect(backend.sessions.at(-1)?.destroyed).toBeTrue()
  })

  test('rejects persisted state from another backend', async () => {
    const store = new MemoryStore()
    store.states.set('session-1', {
      type: 'resume-session',
      harnessId: 'other',
      specificationVersion: 'harness-v1',
      data: {}
    })
    const service = new HarnessSessionService(new Map([['pi', new FakeBackend()]]), store)
    await expect(service.createSession('session-1', configuration)).rejects.toThrow(
      'belongs to other'
    )
  })
})
