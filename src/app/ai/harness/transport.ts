import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'

import type {
  HarnessSessionConfiguration,
  HarnessSidecarMessage,
  HarnessTurnEvent
} from '@open-pencil/harness'

import { spawnHarnessProcess, type HarnessProcess } from './process'

interface PendingRequest {
  controller?: ReadableStreamDefaultController<UIMessageChunk>
  resolve: (message: HarnessSidecarMessage) => void
  reject: (error: Error) => void
  textId: string
  textStarted: boolean
  reasoningStarted: boolean
}

function requestID(): string {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new TypeError('Harness requests require Web Crypto')
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function mapEvent(event: HarnessTurnEvent, pending: PendingRequest): UIMessageChunk[] {
  const chunks: UIMessageChunk[] = []
  if (event.type === 'text-delta') {
    if (!pending.textStarted) {
      chunks.push({ type: 'text-start', id: pending.textId })
      pending.textStarted = true
    }
    chunks.push({ type: 'text-delta', id: pending.textId, delta: event.text })
  } else if (event.type === 'reasoning-delta') {
    const id = `reasoning-${pending.textId}`
    if (!pending.reasoningStarted) {
      chunks.push({ type: 'reasoning-start', id })
      pending.reasoningStarted = true
    }
    chunks.push({ type: 'reasoning-delta', id, delta: event.text })
  } else if (event.type === 'tool-call') {
    chunks.push({
      type: 'tool-input-available',
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      input: event.input,
      providerExecuted: true
    })
  } else if (event.type === 'tool-result') {
    chunks.push({
      type: 'tool-output-available',
      toolCallId: event.toolCallId,
      output: event.output,
      providerExecuted: true
    })
  } else if (event.type === 'error') {
    chunks.push({ type: 'error', errorText: event.message })
  }
  return chunks
}

export class HarnessChatTransport implements ChatTransport<UIMessage> {
  private process: HarnessProcess | null = null
  private readonly pending = new Map<string, PendingRequest>()
  private sessionCreated = false
  private destroyed = false

  constructor(
    private readonly sessionId: string,
    private readonly configuration: HarnessSessionConfiguration,
    private readonly environment: Record<string, string>
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

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        const pending = this.createPending(requestId)
        pending.controller = controller
        this.pending.set(requestId, pending)
        controller.enqueue({ type: 'start' })
        controller.enqueue({ type: 'start-step' })
        const cancel = () => {
          void process
            .send({
              id: requestID(),
              method: 'session.cancel',
              params: { sessionId: this.sessionId }
            })
            .catch((error) =>
              this.failAll(error instanceof Error ? error : new Error(String(error)))
            )
        }
        if (abortSignal?.aborted) {
          cancel()
          controller.enqueue({ type: 'finish-step' })
          controller.enqueue({ type: 'finish', finishReason: 'stop' })
          controller.close()
          this.pending.delete(requestId)
          return
        }
        abortSignal?.addEventListener('abort', cancel, { once: true })
        void process.send({
          id: requestId,
          method: 'session.turn',
          params: { sessionId: this.sessionId, prompt: text }
        })
      }
    })
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
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
      textId: `text-${id}`,
      textStarted: false,
      reasoningStarted: false
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
        textId: `text-${id}`,
        textStarted: false,
        reasoningStarted: false
      })
      void process.send({ id, ...request }).catch(reject)
    })
  }

  private async ensureProcess(): Promise<HarnessProcess> {
    if (this.process) return this.process
    this.destroyed = false
    const environment = this.environment
    const process = await spawnHarnessProcess({
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
          if (pending?.controller) {
            for (const chunk of mapEvent(message.event, pending)) pending.controller.enqueue(chunk)
          }
        } else {
          const pending = this.pending.get(message.id)
          if (pending) {
            this.pending.delete(message.id)
            if (message.error) {
              const error = new Error(message.error)
              pending.controller?.enqueue({ type: 'error', errorText: error.message })
              pending.reject(error)
            } else {
              if (pending.reasoningStarted) {
                pending.controller?.enqueue({
                  type: 'reasoning-end',
                  id: `reasoning-${pending.textId}`
                })
              }
              if (pending.textStarted) {
                pending.controller?.enqueue({ type: 'text-end', id: pending.textId })
              }
              pending.controller?.enqueue({ type: 'finish-step' })
              pending.controller?.enqueue({ type: 'finish', finishReason: 'stop' })
              pending.resolve(message)
            }
            pending.controller?.close()
          }
        }
        next = await reader.read()
      }
    } catch (error) {
      this.failAll(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private failAll(error: Error): void {
    if (this.destroyed) return
    this.process = null
    this.sessionCreated = false
    for (const pending of this.pending.values()) {
      pending.controller?.enqueue({ type: 'error', errorText: error.message })
      pending.controller?.close()
      pending.reject(error)
    }
    this.pending.clear()
  }
}
