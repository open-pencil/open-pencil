import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'

import type {
  HarnessSessionConfiguration,
  HarnessSidecarMessage,
  HarnessTurnEvent,
  HarnessTurnUsage
} from '@open-pencil/harness'

import { spawnHarnessProcess, type HarnessProcess } from '@/app/ai/agents/pi/process'
import { createReplyStream, type ReplyStream } from '@/app/ai/reply/stream'

interface PendingRequest {
  controller?: ReadableStreamDefaultController<UIMessageChunk>
  resolve: (message: HarnessSidecarMessage) => void
  reject: (error: Error) => void
  stream: ReplyStream
}

function requestID(): string {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new TypeError('Harness requests require Web Crypto')
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Sends chunks to a reply still being read; once it finished or was cancelled, they are dropped. */
function emit(pending: PendingRequest, ...chunks: UIMessageChunk[]): void {
  for (const chunk of chunks) pending.controller?.enqueue(chunk)
}

/** Closes the reply's open text or thought, then finishes it. */
function finishReply(pending: PendingRequest): void {
  emit(
    pending,
    ...pending.stream.end(),
    { type: 'finish-step' },
    { type: 'finish', finishReason: 'stop' }
  )
}

/** Ends a reply's stream, once; later events for its turn go nowhere. */
function close(pending: PendingRequest): void {
  const { controller } = pending
  pending.controller = undefined
  controller?.close()
}

function mapEvent(event: HarnessTurnEvent, { stream }: PendingRequest): UIMessageChunk[] {
  switch (event.type) {
    case 'text-delta':
      return stream.text(event.text)
    case 'reasoning-delta':
      return stream.thought(event.text)
    case 'tool-call':
      return stream.toolInput({ id: event.toolCallId, name: event.toolName }, event.input)
    case 'tool-result':
      return stream.toolResult(event.toolCallId, event.output)
    case 'error':
      return [{ type: 'error', errorText: event.message }]
    default:
      return []
  }
}

export class HarnessChatTransport implements ChatTransport<UIMessage> {
  private process: HarnessProcess | null = null
  private readonly pending = new Map<string, PendingRequest>()
  private sessionCreated = false
  private destroyed = false

  constructor(
    private readonly sessionId: string,
    private readonly configuration: HarnessSessionConfiguration,
    private readonly environment: Record<string, string>,
    private readonly spawnProcess: typeof spawnHarnessProcess = spawnHarnessProcess,
    /** Told each turn's tokens, which the Usage settings count with the chat's other models. */
    private readonly onUsage?: (usage: HarnessTurnUsage) => void
  ) {}

  async sendMessages({
    messages,
    abortSignal
  }: Parameters<ChatTransport<UIMessage>['sendMessages']>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    const process = await this.ensureProcess()
    if (!this.sessionCreated) {
      await this.request({
        method: 'session.create',
        params: { sessionId: this.sessionId, configuration: this.configuration }
      })
      this.sessionCreated = true
    }
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    const text =
      lastUserMessage?.parts
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('\n') ?? ''
    const requestId = requestID()
    const pending = this.createPending(requestId)
    let cancelled = false
    // Stop cancels the turn, which keeps its session and sandbox. The turn's entry stays until
    // the companion answers it, so that answer and any late events are consumed, not misread.
    const cancel = () => {
      if (cancelled) return
      cancelled = true
      void process
        .send({ id: requestID(), method: 'session.cancel', params: { sessionId: this.sessionId } })
        .catch(this.fail)
    }

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        pending.controller = controller
        emit(pending, { type: 'start' }, { type: 'start-step' })
        if (abortSignal?.aborted) {
          finishReply(pending)
          close(pending)
          return
        }
        this.pending.set(requestId, pending)
        abortSignal?.addEventListener(
          'abort',
          () => {
            // A turn already answered has nothing to stop, and a cancel now would hit the next one.
            if (!this.pending.has(requestId)) return
            cancel()
            finishReply(pending)
            close(pending)
          },
          { once: true }
        )
        void process
          .send({
            id: requestId,
            method: 'session.turn',
            params: { sessionId: this.sessionId, prompt: text }
          })
          .catch(this.fail)
      },
      // The reader went away, as Stop makes it: nothing more is read from this turn.
      cancel: () => {
        pending.controller = undefined
        cancel()
      }
    })
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }

  async stop(): Promise<void> {
    if (this.destroyed) return
    try {
      if (this.sessionCreated) {
        await this.request({ method: 'session.stop', params: { sessionId: this.sessionId } })
      }
    } finally {
      // Stopping must never delete resume state, including when saving it fails.
      this.sessionCreated = false
      await this.destroy()
    }
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return
    this.destroyed = true
    const process = this.process
    const sessionCreated = this.sessionCreated
    this.process = null
    this.sessionCreated = false
    if (process) {
      if (sessionCreated) {
        await process
          .send({
            id: requestID(),
            method: 'session.destroy',
            params: { sessionId: this.sessionId }
          })
          .catch(() => undefined)
      }
      await process.child.kill().catch(() => undefined)
    }
    for (const pending of this.pending.values()) pending.reject(new Error('Harness stopped'))
    this.pending.clear()
  }

  private createPending(id: string): PendingRequest {
    return {
      resolve: () => undefined,
      reject: () => undefined,
      stream: createReplyStream(`turn-${id}`)
    }
  }

  private async request(request: {
    method: string
    params: object
  }): Promise<HarnessSidecarMessage> {
    const process = await this.ensureProcess()
    const id = requestID()
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        stream: createReplyStream(`turn-${id}`)
      })
      void process.send({ id, ...request }).catch(reject)
    })
  }

  private async ensureProcess(): Promise<HarnessProcess> {
    if (this.process) return this.process
    this.destroyed = false
    const environment = this.environment
    const process = await this.spawnProcess({
      environment,
      onUnexpectedClose: () => this.failAll(new Error('Harness process exited unexpectedly'))
    })
    this.process = process
    void this.readMessages(process)
    return process
  }

  private async readMessages(process: HarnessProcess): Promise<void> {
    try {
      const reader = process.messages.getReader()
      let next = await reader.read()
      while (!next.done) {
        const message = next.value
        if (message.type === 'turn.event') {
          const pending = this.pending.get(message.id)
          if (pending) emit(pending, ...mapEvent(message.event, pending))
          if (pending && message.event.type === 'finish' && message.event.usage) {
            this.onUsage?.(message.event.usage)
          }
        } else {
          const pending = this.pending.get(message.id)
          if (pending) {
            this.pending.delete(message.id)
            if (message.error) {
              const error = new Error(message.error)
              emit(pending, { type: 'error', errorText: error.message })
              pending.reject(error)
            } else {
              finishReply(pending)
              pending.resolve(message)
            }
            close(pending)
          }
        }
        next = await reader.read()
      }
    } catch (error) {
      // A process whose messages can no longer be read is given up on, so it must not outlive it.
      await process.child.kill().catch(() => undefined)
      this.fail(error)
    }
  }

  private readonly fail = (error: unknown): void => {
    this.failAll(error instanceof Error ? error : new Error(String(error)))
  }

  private failAll(error: Error): void {
    if (this.destroyed) return
    this.process = null
    this.sessionCreated = false
    for (const pending of this.pending.values()) {
      emit(pending, { type: 'error', errorText: error.message })
      close(pending)
      pending.reject(error)
    }
    this.pending.clear()
  }
}
