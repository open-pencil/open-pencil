import { createPi } from '@ai-sdk/harness-pi'
import type { PiAuthOptions } from '@ai-sdk/harness-pi'
import { HarnessAgent } from '@ai-sdk/harness/agent'
import type { HarnessAgentResumeSessionState, HarnessAgentSession } from '@ai-sdk/harness/agent'
import { createJustBashSandbox } from '@ai-sdk/sandbox-just-bash'
import type { TextStreamPart, ToolSet } from 'ai'

import type { HarnessSessionConfiguration, JSONValue } from '../protocol'

function optional<T>(key: string, value: T | undefined): Record<string, T> {
  return value === undefined ? {} : { [key]: value }
}

function restoreEnvironment(previous: Map<string, string | undefined>): void {
  for (const [name, value] of previous) {
    if (value === undefined) Reflect.deleteProperty(process.env, name)
    else process.env[name] = value
  }
}

async function withEnvironment<T>(
  environment: Record<string, string>,
  run: () => Promise<T>
): Promise<T> {
  const previous = new Map<string, string | undefined>()
  for (const [name, value] of Object.entries(environment)) {
    previous.set(name, process.env[name])
    process.env[name] = value
  }
  try {
    return await run()
  } finally {
    restoreEnvironment(previous)
  }
}
import type { BackendEvent, BackendSession, HarnessBackend, HarnessResumeState } from './types'

export type PiThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

export interface PiHarnessBackendOptions {
  auth?: PiAuthOptions
  apiKey?: string
  model?: string
  thinkingLevel?: PiThinkingLevel
  agentDir?: string
  mcpServers?: Record<string, unknown>
  instructions?: string
  permissionMode?: 'allow-all' | 'allow-reads' | 'allow-edits'
}

function asJSONValue(value: unknown): JSONValue {
  if (value === undefined || typeof value === 'bigint' || typeof value === 'function') return null
  try {
    const clone = structuredClone(value)
    JSON.stringify(clone)
    return clone as JSONValue
  } catch {
    return null
  }
}

function mapPart(part: TextStreamPart<ToolSet>): BackendEvent | undefined {
  if (part.type === 'text-delta') return { type: 'text-delta', text: part.text }
  if (part.type === 'reasoning-delta') return { type: 'reasoning-delta', text: part.text }
  if (part.type === 'tool-call') {
    return {
      type: 'tool-call',
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      input: asJSONValue(part.input)
    }
  }
  if (part.type === 'tool-result') {
    return {
      type: 'tool-result',
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      output: asJSONValue(part.output)
    }
  }
  if (part.type === 'finish') return { type: 'finish', finishReason: part.finishReason }
  if (part.type === 'error') {
    return {
      type: 'error',
      message: part.error instanceof Error ? part.error.message : String(part.error)
    }
  }
  return undefined
}

class PiBackendSession implements BackendSession {
  readonly sessionId: string
  readonly isResume: boolean

  constructor(
    private readonly agent: HarnessAgent,
    private readonly session: HarnessAgentSession
  ) {
    this.sessionId = session.sessionId
    this.isResume = session.isResume
  }

  async *runTurn(prompt: string, signal?: AbortSignal): AsyncIterable<BackendEvent> {
    const result = await this.agent.stream({ session: this.session, prompt, abortSignal: signal })
    for await (const part of result.fullStream) {
      const event = mapPart(part)
      if (event) yield event
    }
  }

  async stop(): Promise<HarnessResumeState> {
    return (await this.session.stop()) as HarnessResumeState
  }

  async destroy(): Promise<void> {
    await this.session.destroy()
  }
}

export class PiHarnessBackend implements HarnessBackend {
  readonly id = 'pi'
  readonly capabilities = {
    adapter: 'pi',
    sandboxes: ['just-bash'],
    structuredOutput: false,
    sessionResume: 'live-process',
    turnContinuation: true
  } as const

  constructor(private readonly defaults: PiHarnessBackendOptions = {}) {}

  async createSession(options: {
    sessionId: string
    resumeState?: HarnessResumeState
    configuration?: HarnessSessionConfiguration
    signal?: AbortSignal
  }): Promise<BackendSession> {
    const configuration = options.configuration
    if (!configuration) throw new Error('Harness configuration is required')
    const thinkingLevel =
      typeof configuration.settings?.thinkingLevel === 'string'
        ? (configuration.settings.thinkingLevel as PiThinkingLevel)
        : undefined
    const permissionMode =
      typeof configuration.settings?.permissionMode === 'string'
        ? (configuration.settings.permissionMode as PiHarnessBackendOptions['permissionMode'])
        : undefined
    const environment: Record<string, string> = this.defaults.apiKey
      ? { AI_GATEWAY_API_KEY: this.defaults.apiKey }
      : {}
    return withEnvironment(environment, async () => {
      const harness = createPi({
        ...optional('auth', this.defaults.auth),
        ...optional('model', configuration.model),
        ...optional('thinkingLevel', thinkingLevel ?? this.defaults.thinkingLevel),
        ...optional('agentDir', this.defaults.agentDir),
        ...optional('mcpServers', options.configuration?.mcpServers ?? this.defaults.mcpServers)
      })
      const agent = new HarnessAgent({
        harness,
        sandbox: createJustBashSandbox({ cwd: '/workspace' }),
        sandboxConfig: { workDir: 'workspace' },
        ...optional('instructions', configuration.instructions ?? this.defaults.instructions),
        permissionMode: permissionMode ?? this.defaults.permissionMode ?? 'allow-edits'
      })
      const session = await agent.createSession({
        sessionId: options.sessionId,
        ...(options.resumeState === undefined
          ? {}
          : { resumeFrom: options.resumeState as HarnessAgentResumeSessionState }),
        ...(options.signal === undefined ? {} : { abortSignal: options.signal })
      })
      return new PiBackendSession(agent, session)
    })
  }
}
