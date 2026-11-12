import {
  AgentSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type Agent,
  type ContentBlock,
  type NewSessionRequest,
  type SessionConfigOption,
  type SetSessionConfigOptionRequest
} from '@agentclientprotocol/sdk'

import type { OneOffStartup } from '@/app/ai/agents/acp/oneoff'
import { createDeferred } from '@/app/runtime/deferred'

export const WORKSPACE = '/agent-workspace'

/** What an agent offers for choosing its model: its own pick, or Opus. */
export const MODEL_OPTIONS: SessionConfigOption[] = [
  {
    id: 'model',
    name: 'Model',
    type: 'select',
    category: 'model',
    currentValue: 'default',
    options: [
      { value: 'default', name: 'Default' },
      { value: 'opus', name: 'Opus' }
    ]
  }
]

interface FakeAgentOptions {
  /** Whether the agent takes images in a prompt, as its initialize answer says. */
  imageInput?: boolean
  /** What the agent offers for choosing its model; none when absent. */
  configOptions?: SessionConfigOption[]
  /** The text the agent answers a prompt with, sent as one message chunk each. */
  answer?: string[]
  /** A request the agent never answers: its process exits, or it just hangs. */
  stalls?: { on: 'initialize' | 'newSession' | 'prompt'; as: 'exits' | 'hangs' }
}

/** One in-memory ACP agent per start, standing in for the process the app would spawn. */
export function fakeOneOffAgent({
  imageInput = true,
  configOptions,
  answer = [],
  stalls
}: FakeAgentOptions = {}) {
  const created: NewSessionRequest[] = []
  const configured: SetSessionConfigOptionRequest[] = []
  const prompts: ContentBlock[][] = []
  const cwds: (string | undefined)[] = []
  const sessionRequested = createDeferred<undefined>()
  const promptRequested = createDeferred<undefined>()
  let kills = 0
  let spawns = 0

  const startup: OneOffStartup = {
    resolveTarget: async (agent) => ({ command: agent.command, searchPath: '/lookup/bin' }),
    workspace: async () => WORKSPACE,
    spawn: async (options) => {
      spawns++
      cwds.push(options.cwd)
      const toAgent = new TransformStream<Uint8Array, Uint8Array>()
      const toClient = new TransformStream<Uint8Array, Uint8Array>()
      // Ending the pipe ends what the client reads, as a process that exits does.
      const output = new TransformStream<Uint8Array, Uint8Array>()
      const stop = new AbortController()
      toClient.readable
        .pipeTo(output.writable, { signal: stop.signal, preventCancel: true })
        .catch(() => undefined)
      const stall = async (on: NonNullable<typeof stalls>['on']) => {
        if (stalls?.on !== on) return
        if (stalls.as === 'exits') stop.abort()
        await createDeferred<never>().promise
      }
      const agent: Agent = {
        async initialize() {
          await stall('initialize')
          return {
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: { promptCapabilities: { image: imageInput } }
          }
        },
        async newSession(params) {
          created.push(params)
          sessionRequested.resolve(undefined)
          await stall('newSession')
          return { sessionId: 'session-1', configOptions }
        },
        async setSessionConfigOption(params) {
          configured.push(params)
          return { configOptions: [] }
        },
        async prompt(params) {
          prompts.push(params.prompt)
          promptRequested.resolve(undefined)
          await stall('prompt')
          for (const text of answer) {
            await connection.sessionUpdate({
              sessionId: params.sessionId,
              update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } }
            })
          }
          return { stopReason: 'end_turn' }
        },
        async authenticate() {
          return {}
        },
        cancel: async () => undefined
      }
      const connection = new AgentSideConnection(
        () => agent,
        ndJsonStream(toClient.writable, toAgent.readable)
      )
      return {
        child: {
          write: async () => undefined,
          kill: async () => {
            kills++
            stop.abort()
          }
        },
        input: toAgent.writable,
        output: output.readable
      }
    }
  }

  return {
    startup,
    created,
    configured,
    prompts,
    cwds,
    sessionRequested: sessionRequested.promise,
    promptRequested: promptRequested.promise,
    kills: () => kills,
    spawns: () => spawns
  }
}
