import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'

import SYSTEM_PROMPT from '@/ai/system-prompt.md?raw'
import { decodeTauriStderr } from '@/utils/tauri'

import { mapUpdate } from './acp-map-update'

import type {
  Client,
  Agent,
  SessionNotification,
  RequestPermissionRequest,
  RequestPermissionResponse
} from '@agentclientprotocol/sdk'
import type { ACPAgentDef } from '@open-pencil/core'
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'

type TauriChild = {
  write(data: number[]): Promise<void>
  kill(): Promise<void>
}

interface ACPSession {
  connection: ClientSideConnection
  sessionId: string
  child: TauriChild
  onUpdate: ((params: SessionNotification) => void) | null
  dead: boolean
}

function isMissingCommandError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('enoent') ||
    normalized.includes('not found') ||
    normalized.includes('no such file') ||
    normalized.includes('program not found')
  )
}

function missingCommandMessage(agentDef?: ACPAgentDef): string {
  if (!agentDef) return 'ACP agent CLI is not installed.'
  if (!agentDef.installCommand) {
    return `"${agentDef.command}" is not installed. Install it and restart OpenPencil.`
  }
  return `"${agentDef.command}" is not installed. Install it with: ${agentDef.installCommand}`
}

export function formatConnectionError(e: unknown, agentDef?: ACPAgentDef): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (
    msg.includes('ECONNREFUSED') ||
    msg.includes('fetch failed') ||
    msg.includes('Failed to fetch')
  ) {
    return 'MCP server is not running. Make sure the editor is open.'
  }
  if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('ETIMEDOUT')) {
    return 'MCP server did not respond in time.'
  }
  if (isMissingCommandError(msg)) {
    return missingCommandMessage(agentDef)
  }
  return msg
}

export function buildCrashChunks(
  destroying: boolean,
  textId: string,
  textStarted: boolean
): { chunks: UIMessageChunk[]; shouldNullSession: boolean } {
  if (destroying) return { chunks: [], shouldNullSession: false }
  const chunks: UIMessageChunk[] = []
  if (textStarted) chunks.push({ type: 'text-end', id: textId })
  chunks.push({ type: 'error', errorText: 'Agent process exited unexpectedly.' })
  chunks.push({ type: 'finish-step' })
  chunks.push({ type: 'finish', finishReason: 'error' })
  return { chunks, shouldNullSession: true }
}

interface ACPDebugEntry {
  ts: number
  type: string
  data: unknown
}

const MAX_LOG_AGE_MS = 5 * 60 * 1000
const IS_DEV = import.meta.env.DEV

export const acpDebugLog: ACPDebugEntry[] = []

function pruneOldEntries() {
  const cutoff = Date.now() - MAX_LOG_AGE_MS
  while (acpDebugLog.length > 0 && acpDebugLog[0].ts < cutoff) {
    acpDebugLog.shift()
  }
}

export function getAcpDebugText(): string {
  pruneOldEntries()
  return acpDebugLog
    .map((e) => `[${new Date(e.ts).toISOString()}] ${e.type}\n${JSON.stringify(e.data, null, 2)}`)
    .join('\n\n---\n\n')
}

export function clearAcpDebugLog() {
  acpDebugLog.length = 0
}

export function hasAcpDebugEntries(): boolean {
  pruneOldEntries()
  return acpDebugLog.length > 0
}

export class ACPChatTransport implements ChatTransport<UIMessage> {
  private session: ACPSession | null = null
  private agentDef: ACPAgentDef
  private cwd: string
  private sentContext = false
  private destroying = false

  constructor(options: { agentDef: ACPAgentDef; cwd?: string }) {
    this.agentDef = options.agentDef
    this.cwd = options.cwd ?? '.'
  }

  async sendMessages({
    messages,
    abortSignal
  }: Parameters<ChatTransport<UIMessage>['sendMessages']>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    const text =
      lastUserMessage?.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n') ?? ''

    if (this.session?.dead) {
      this.session = null
    }

    if (!this.session) {
      this.session = await this.spawnAgent()
    }

    const promptText = this.sentContext ? text : `${SYSTEM_PROMPT}\n\n${text}`
    this.sentContext = true

    const { connection, sessionId } = this.session
    const session = this.session

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        const textId = `text-${Date.now()}`
        let textStarted = false
        let closed = false

        function finish(reason: 'stop' | 'other' | 'error', errorText?: string) {
          if (closed) return
          closed = true
          if (errorText) controller.enqueue({ type: 'error', errorText })
          if (textStarted) controller.enqueue({ type: 'text-end', id: textId })
          controller.enqueue({ type: 'finish-step' })
          controller.enqueue({ type: 'finish', finishReason: reason })
          session.onUpdate = null
          controller.close()
        }

        session.onUpdate = (params) => {
          if (closed) return
          if (IS_DEV) {
            acpDebugLog.push({
              ts: Date.now(),
              type: params.update.sessionUpdate,
              data: params.update
            })
          }
          const result = mapUpdate(params.update, textId, textStarted)
          for (const chunk of result.chunks) {
            controller.enqueue(chunk)
          }
          textStarted = result.textStarted
        }

        abortSignal?.addEventListener('abort', () => {
          void connection.cancel({ sessionId })
          finish('stop')
        })

        controller.enqueue({ type: 'start' })
        controller.enqueue({ type: 'start-step' })

        connection
          .prompt({
            sessionId,
            prompt: [{ type: 'text', text: promptText }]
          })
          .then((result) => {
            finish(result.stopReason === 'end_turn' ? 'stop' : 'other')
          })
          .catch((e) => {
            finish('error', formatConnectionError(e, this.agentDef))
          })
      }
    })
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }

  async destroy(): Promise<void> {
    this.destroying = true
    if (this.session) {
      await this.session.child.kill()
      this.session = null
    }
  }

  private async spawnAgent(): Promise<ACPSession> {
    const { Command } = await import('@tauri-apps/plugin-shell')

    const command = Command.create(this.agentDef.command, this.agentDef.args, {
      encoding: 'raw'
    })

    const stdoutChunks: Uint8Array[] = []
    let stdoutResolver: ((chunk: Uint8Array | null) => void) | null = null
    let stdoutClosed = false
    let stdoutClosedError: Error | null = null

    command.stdout.on('data', (raw: Uint8Array | number[]) => {
      const chunk = raw instanceof Uint8Array ? raw : new Uint8Array(raw)
      if (stdoutResolver) {
        const resolve = stdoutResolver
        stdoutResolver = null
        resolve(chunk)
      } else {
        stdoutChunks.push(chunk)
      }
    })

    command.stderr.on('data', (raw: Uint8Array | number[] | string) => {
      console.error(`[ACP ${this.agentDef.id}]`, decodeTauriStderr(raw))
    })

    command.on('close', () => {
      stdoutClosed = true
      stdoutClosedError = this.destroying ? null : new Error('Agent process exited unexpectedly.')
      if (stdoutResolver) {
        const resolve = stdoutResolver
        stdoutResolver = null
        resolve(null)
      }
      if (this.destroying || !this.session) return
      this.session.dead = true
      this.session = null
    })

    let child: TauriChild
    try {
      child = await command.spawn()
    } catch (e) {
      throw new Error(formatConnectionError(e, this.agentDef))
    }

    const output = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const buffered = stdoutChunks.shift()
        if (buffered) {
          controller.enqueue(buffered)
          return
        }
        if (stdoutClosed) {
          if (stdoutClosedError) controller.error(stdoutClosedError)
          else controller.close()
          return
        }
        const chunk = await new Promise<Uint8Array | null>((resolve) => {
          stdoutResolver = resolve
        })
        if (chunk) {
          controller.enqueue(chunk)
          return
        }
        if (stdoutClosedError) controller.error(stdoutClosedError)
        else controller.close()
      }
    })

    const input = new WritableStream<Uint8Array>({
      async write(chunk) {
        await child.write(Array.from(chunk))
      }
    })

    const stream = ndJsonStream(input, output)
    let onUpdate: ACPSession['onUpdate'] = null

    const clientImpl: Client = {
      async requestPermission(
        params: RequestPermissionRequest
      ): Promise<RequestPermissionResponse> {
        const { requestPermissionFromUser } = await import('@/ai/acp-permission')
        return requestPermissionFromUser(params)
      },

      async sessionUpdate(params: SessionNotification): Promise<void> {
        onUpdate?.(params)
      }
    }

    const connection = new ClientSideConnection((_agent: Agent) => clientImpl, stream)
    const { getAutomationAuthToken } = await import('@/automation/spawn-mcp')
    const automationAuthToken = await getAutomationAuthToken()

    await connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {}
    })

    let sessionResult
    try {
      sessionResult = await connection.newSession({
        cwd: this.cwd,
        mcpServers: [
          {
            type: 'http' as const,
            name: 'open-pencil',
            url: 'http://127.0.0.1:7600/mcp',
            headers: automationAuthToken
              ? [{ name: 'Authorization', value: `Bearer ${automationAuthToken}` }]
              : []
          }
        ]
      })
    } catch (e) {
      await child.kill()
      throw new Error(formatConnectionError(e, this.agentDef))
    }

    const session: ACPSession = {
      connection,
      sessionId: sessionResult.sessionId,
      child,
      dead: false,
      get onUpdate() {
        return onUpdate
      },
      set onUpdate(fn) {
        onUpdate = fn
      }
    }

    return session
  }
}
