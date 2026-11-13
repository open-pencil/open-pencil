import {
  agent as acpAgent,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  type ContentBlock,
  type NewSessionRequest,
  type SessionConfigOption,
  type SessionOptionsRequest,
  type SetSessionConfigOptionRequest
} from '@agentclientprotocol/sdk/unstable'

import type { AgentLaunch } from '@/app/ai/agents/acp/connection'
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
  /** Whether the agent answers `session/options`, so its options are read without a session. */
  answersOptions?: boolean
  /** The text the agent answers a prompt with, sent as one message chunk each. */
  answer?: string[]
  /** A request the agent never answers: its process exits, or it just hangs. */
  stalls?: { on: 'initialize' | 'newSession' | 'prompt'; as: 'exits' | 'hangs' }
}

/** One in-memory ACP agent per start, standing in for the process the app would spawn. */
export function fakeOneOffAgent({
  imageInput = true,
  configOptions,
  answersOptions = false,
  answer = [],
  stalls
}: FakeAgentOptions = {}) {
  const created: NewSessionRequest[] = []
  const optionsRead: SessionOptionsRequest[] = []
  const configured: SetSessionConfigOptionRequest[] = []
  const prompts: ContentBlock[][] = []
  const cwds: (string | undefined)[] = []
  const sessionRequested = createDeferred<undefined>()
  const promptRequested = createDeferred<undefined>()
  let kills = 0
  let spawns = 0

  const launch: AgentLaunch = {
    resolveTarget: async (agent) => ({ command: agent.command, searchPath: '/lookup/bin' }),
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
      acpAgent()
        .onRequest(methods.agent.initialize, async () => {
          await stall('initialize')
          return {
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: {
              promptCapabilities: { image: imageInput },
              sessionCapabilities: answersOptions ? { options: {} } : {}
            }
          }
        })
        .onRequest(methods.agent.session.options, ({ params }) => {
          optionsRead.push(params)
          return { configOptions }
        })
        .onRequest(methods.agent.session.new, async ({ params }) => {
          created.push(params)
          sessionRequested.resolve(undefined)
          await stall('newSession')
          return { sessionId: 'session-1', configOptions }
        })
        .onRequest(methods.agent.session.setConfigOption, ({ params }) => {
          configured.push(params)
          return { configOptions: [] }
        })
        .onRequest(methods.agent.session.prompt, async ({ params, client }) => {
          prompts.push(params.prompt)
          promptRequested.resolve(undefined)
          await stall('prompt')
          for (const text of answer) {
            await client.notify(methods.client.session.update, {
              sessionId: params.sessionId,
              update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } }
            })
          }
          return { stopReason: 'end_turn' }
        })
        .onNotification(methods.agent.session.cancel, () => undefined)
        .connect(ndJsonStream(toClient.writable, toAgent.readable))
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
    /** What a one-off job starts the agent with. */
    startup: { launch, workspace: async () => WORKSPACE },
    created,
    optionsRead,
    configured,
    prompts,
    cwds,
    sessionRequested: sessionRequested.promise,
    promptRequested: promptRequested.promise,
    kills: () => kills,
    spawns: () => spawns
  }
}
