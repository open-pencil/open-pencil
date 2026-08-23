import type { BackendEvent, BackendSession, HarnessBackend } from './backends/types'
import type { HarnessSessionConfiguration, JSONValue } from './protocol'
import type { ResumeStateStore } from './session-store'

export class HarnessSessionService {
  private readonly sessions = new Map<string, BackendSession>()
  private readonly turns = new Map<string, AbortController>()

  constructor(
    private readonly backends: ReadonlyMap<string, HarnessBackend>,
    private readonly store: ResumeStateStore
  ) {}

  capabilities(): JSONValue {
    return this.backends.size
      ? [...this.backends.values()].map((backend) => ({
          ...backend.capabilities,
          sandboxes: [...backend.capabilities.sandboxes]
        }))
      : []
  }

  async createSession(
    sessionId: string,
    configuration: HarnessSessionConfiguration,
    signal?: AbortSignal
  ): Promise<{ isResume: boolean }> {
    if (this.sessions.has(sessionId))
      throw new Error(`Harness session already active: ${sessionId}`)
    const backend = this.backends.get(configuration.adapter)
    if (!backend) throw new Error(`Harness adapter is unavailable: ${configuration.adapter}`)
    const resumeState = await this.store.load(sessionId)
    if (resumeState && resumeState.harnessId !== backend.id) {
      throw new Error(`Harness state belongs to ${resumeState.harnessId}, not ${backend.id}`)
    }
    const session = await backend.createSession({
      sessionId,
      resumeState,
      configuration,
      signal
    })
    this.sessions.set(sessionId, session)
    return { isResume: session.isResume }
  }

  async *runTurn(
    sessionId: string,
    prompt: string,
    signal?: AbortSignal
  ): AsyncIterable<BackendEvent> {
    const session = this.requireSession(sessionId)
    if (this.turns.has(sessionId)) throw new Error(`Harness turn already active: ${sessionId}`)
    const controller = new AbortController()
    this.turns.set(sessionId, controller)
    const abort = () => controller.abort()
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
    try {
      yield* session.runTurn(prompt, controller.signal)
    } finally {
      signal?.removeEventListener('abort', abort)
      if (this.turns.get(sessionId) === controller) this.turns.delete(sessionId)
    }
  }

  cancelTurn(sessionId: string): void {
    this.requireSession(sessionId)
    this.turns.get(sessionId)?.abort()
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId)
    const state = await session.stop()
    await this.store.save(sessionId, state)
    this.sessions.delete(sessionId)
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId)
    await session.destroy()
    await this.store.remove(sessionId)
    this.sessions.delete(sessionId)
  }

  async shutdown(): Promise<void> {
    const sessions = [...this.sessions.entries()]
    const results = await Promise.allSettled(
      sessions.map(async ([sessionId, session]) => {
        const state = await session.stop()
        await this.store.save(sessionId, state)
        this.sessions.delete(sessionId)
      })
    )
    const errors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason)
    if (errors.length) throw new AggregateError(errors, 'Harness shutdown failed')
  }

  private requireSession(sessionId: string): BackendSession {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Harness session is not active: ${sessionId}`)
    return session
  }
}
