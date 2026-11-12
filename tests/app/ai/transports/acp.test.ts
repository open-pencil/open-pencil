import { expect, test } from 'bun:test'

import {
  AgentSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  RequestError,
  type Agent,
  type NewSessionRequest,
  type ResumeSessionRequest,
  type SessionConfigOption
} from '@agentclientprotocol/sdk'
import type { UIMessage, UIMessageChunk } from 'ai'

import { ACP_AGENTS, type ACPAgentDef } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import { OWN_TOOLS_ALLOWED } from '@/app/ai/agents/acp/tools'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt'
import { ACPChatTransport, type ACPStartup } from '@/app/ai/transports/acp'
import { diagnosticErrorDetails, diagnostics } from '@/app/diagnostics'
import { createDeferred } from '@/app/runtime/deferred'

import { MODEL_OPTIONS } from '#tests/helpers/ai/fake-acp-agent'

const resuming = expectDefined(
  ACP_AGENTS.find((agent) => agent.resumesSessions),
  'an agent that resumes sessions'
)
const codex = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'codex'),
  'Codex agent'
)

interface FakeAgentOptions {
  /** False for an agent that runs but never answers a new session. */
  answersSessions?: boolean
  /** Refuses every resume, as for a session the agent no longer has. */
  resumeFails?: boolean
  /** An adapter error that the real ACP connection serializes before the client receives it. */
  resumeError?: Error
  /** A temporary refusal on the first resume, as when the old process still owns the session. */
  resumeBusy?: boolean
  /** True for an automation token that is never read, as with a credential prompt left open. */
  tokenHangs?: boolean
  /**
   * How the agent's turn ends: `refused` fails before the agent takes the prompt, `cut-off` fails
   * after it started answering. Either way it first sends updates that are not part of a turn.
   */
  turn?: 'answered' | 'refused' | 'cut-off'
  /** True for a command lookup that waits until `finishLookup`, as a slow PATH search does. */
  lookupWaits?: boolean
  /** What the agent offers for choosing its model; none when absent. */
  configOptions?: SessionConfigOption[]
}

/** In-memory ACP agents, one per start, that record what the transport asks of them. */
function fakeAgents({
  answersSessions = true,
  resumeFails = false,
  resumeError,
  resumeBusy = false,
  tokenHangs = false,
  turn = 'answered',
  lookupWaits = false,
  configOptions
}: FakeAgentOptions = {}) {
  const lookup = createDeferred<undefined>()
  const prompts: string[] = []
  /** Startup requests and prompts in the order the agent got them. */
  const calls: string[] = []
  const created: NewSessionRequest[] = []
  const resumed: ResumeSessionRequest[] = []
  const sessionRequested = createDeferred<undefined>()
  const killed = createDeferred<undefined>()
  let kills = 0
  let spawns = 0
  const searchPaths: (string | null | undefined)[] = []
  const defersTools: boolean[] = []
  const cwds: (string | undefined)[] = []
  let crashLatest: (() => void) | null = null

  const spawn: ACPStartup['spawn'] = async (options) => {
    spawns++
    searchPaths.push(options.searchPath)
    cwds.push(options.cwd)
    const toAgent = new TransformStream<Uint8Array, Uint8Array>()
    const toClient = new TransformStream<Uint8Array, Uint8Array>()
    const agent: Agent = {
      async initialize() {
        return {
          protocolVersion: PROTOCOL_VERSION,
          agentCapabilities: { sessionCapabilities: { resume: {} } }
        }
      },
      async newSession(params) {
        created.push(params)
        sessionRequested.resolve(undefined)
        if (!answersSessions) return createDeferred<never>().promise
        return { sessionId: `session-${created.length}`, configOptions }
      },
      async unstable_resumeSession(params) {
        resumed.push(params)
        if (resumeFails) throw RequestError.resourceNotFound(params.sessionId)
        if (resumeError) throw resumeError
        if (resumeBusy && resumed.length === 1)
          throw RequestError.invalidRequest({ reason: 'thread_active_writer' }, 'Session in use')
        return {}
      },
      async prompt(params) {
        const [part] = params.prompt
        calls.push('prompt')
        prompts.push(part?.type === 'text' ? part.text : '')
        const { sessionId } = params
        await connection.sessionUpdate({
          sessionId,
          update: { sessionUpdate: 'available_commands_update', availableCommands: [] }
        })
        if (turn === 'refused') throw new Error('The prompt never reached the model')
        if (turn === 'cut-off') {
          await connection.sessionUpdate({
            sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: 'On it' }
            }
          })
          throw new Error('The turn broke off')
        }
        return { stopReason: 'end_turn' }
      },
      async authenticate() {
        return {}
      },
      async setSessionConfigOption(params) {
        calls.push(`model ${params.value}`)
        return { configOptions: [] }
      },
      cancel: async () => undefined
    }
    const connection = new AgentSideConnection(
      () => agent,
      ndJsonStream(toClient.writable, toAgent.readable)
    )
    // Ending the pipe ends what the client reads, as a process that exits does.
    const output = new TransformStream<Uint8Array, Uint8Array>()
    const stop = new AbortController()
    toClient.readable
      .pipeTo(output.writable, { signal: stop.signal, preventCancel: true })
      .catch(() => undefined)
    crashLatest = () => {
      stop.abort()
      options.onUnexpectedClose()
    }
    return {
      child: {
        write: async () => undefined,
        kill: async () => {
          kills++
          stop.abort()
          killed.resolve(undefined)
        }
      },
      input: toAgent.writable,
      output: output.readable
    }
  }

  const startup: ACPStartup = {
    resolveTarget: async (agent) => {
      if (lookupWaits) await lookup.promise
      return { command: agent.command, searchPath: '/lookup/bin' }
    },
    spawn,
    authToken: async () => (tokenHangs ? createDeferred<never>().promise : null),
    linkTools: async (_token, linkOptions) => {
      defersTools.push(linkOptions?.defersTools ?? false)
      return {
        chat: 'chat',
        mcpServers: [],
        meta: OWN_TOOLS_ALLOWED,
        noteUpdate: () => undefined,
        outcome: async () => ({ connected: true }),
        stop: () => undefined
      }
    }
  }
  return {
    startup,
    prompts,
    calls,
    created,
    resumed,
    sessionRequested: sessionRequested.promise,
    killed: killed.promise,
    kills: () => kills,
    spawns: () => spawns,
    searchPaths,
    cwds,
    defersTools,
    finishLookup: () => lookup.resolve(undefined),
    crash: () => expectDefined(crashLatest, 'a started agent')()
  }
}

function message(role: UIMessage['role'], text: string): UIMessage {
  return { id: crypto.randomUUID(), role, parts: [{ type: 'text', text }] }
}

/** Sends `text` after `history` and waits for the reply to end. */
async function send(
  transport: ACPChatTransport,
  text: string,
  history: UIMessage[] = [],
  abortSignal?: AbortSignal
): Promise<UIMessageChunk[]> {
  const reply = await transport.sendMessages({
    trigger: 'submit-message',
    chatId: 'chat',
    messageId: undefined,
    messages: [...history, message('user', text)],
    abortSignal
  })
  const chunks: UIMessageChunk[] = []
  await reply.pipeTo(new WritableStream({ write: (chunk) => void chunks.push(chunk) }))
  return chunks
}

function transport(
  agents: ReturnType<typeof fakeAgents>,
  options: {
    resume?: string
    startTimeoutMs?: number
    agentDef?: ACPAgentDef
    cwd?: string
    model?: string
  } = {}
) {
  const sessions: (string | null)[] = []
  const agentErrors: unknown[] = []
  const created = new ACPChatTransport({
    agentDef: options.agentDef ?? resuming,
    cwd: options.cwd,
    startup: agents.startup,
    resume: options.resume,
    model: options.model,
    startTimeoutMs: options.startTimeoutMs ?? 1_000,
    onSession: (id) => sessions.push(id),
    onAgentError: (error) => agentErrors.push(error)
  })
  return { transport: created, sessions, agentErrors }
}

test('a new session gets the instructions once and is reported once the agent answers', async () => {
  const agents = fakeAgents()
  const { transport: chat, sessions } = transport(agents)
  await send(chat, 'first')
  await send(chat, 'second', [message('user', 'first'), message('assistant', 'done')])
  expect(agents.created).toHaveLength(1)
  expect(agents.prompts[0]?.startsWith(SYSTEM_PROMPT)).toBe(true)
  expect(agents.prompts[0]?.endsWith('first')).toBe(true)
  expect(agents.prompts[1]).toBe('second')
  expect(sessions).toEqual(['session-1'])
  await chat.destroy()
})

test('the agent starts in its workspace with the PATH its lookup searched', async () => {
  const agents = fakeAgents()
  const { transport: chat } = transport(agents, { cwd: '/agent-workspace' })
  await send(chat, 'first')
  expect(agents.searchPaths).toEqual(['/lookup/bin'])
  expect(agents.cwds).toEqual(['/agent-workspace'])
  expect(agents.created[0]?.cwd).toBe('/agent-workspace')
  await chat.destroy()
})

test('an agent that defers MCP tools gets the server’s call_mcp_tool, others do not', async () => {
  const antigravity = expectDefined(
    ACP_AGENTS.find((agent) => agent.defersMCPTools),
    'an agent that defers MCP tools'
  )
  const agents = fakeAgents()
  const { transport: deferring } = transport(agents, { agentDef: antigravity })
  await send(deferring, 'first')
  await deferring.destroy()
  const { transport: plain } = transport(agents)
  await send(plain, 'first')
  await plain.destroy()
  expect(agents.defersTools).toEqual([true, false])
})

test('a saved session resumes without the instructions or the transcript', async () => {
  const agents = fakeAgents()
  const { transport: chat, sessions } = transport(agents, { resume: 'saved' })
  await send(chat, 'next', [message('user', 'earlier'), message('assistant', 'reply')])
  expect(agents.resumed.map((request) => request.sessionId)).toEqual(['saved'])
  expect(agents.created).toEqual([])
  expect(agents.prompts).toEqual(['next'])
  expect(sessions).toEqual([])
  await chat.destroy()
})

test('an agent that exits continues the same session when it starts again', async () => {
  const agents = fakeAgents()
  const { transport: chat } = transport(agents)
  await send(chat, 'first')
  agents.crash()
  await send(chat, 'second', [message('user', 'first'), message('assistant', 'done')])
  expect(agents.created).toHaveLength(1)
  expect(agents.resumed.map((request) => request.sessionId)).toEqual(['session-1'])
  expect(agents.prompts[1]).toBe('second')
  await chat.destroy()
})

test('a saved session the agent cannot continue is forgotten and no new session starts', async () => {
  await diagnostics.clear()
  const agents = fakeAgents({ resumeFails: true })
  const { transport: chat, sessions } = transport(agents, { resume: 'saved' })
  await expect(send(chat, 'next')).rejects.toBeInstanceOf(Error)
  expect(sessions).toEqual([null])
  expect(agents.created).toEqual([])
  expect(agents.prompts).toEqual([])
  expect(
    (await diagnostics.list()).find((event) => event.name === 'acp.transport.failed')?.attributes
  ).toMatchObject({ errorCode: '-32002' })
})

test('a missing Codex rollout is forgotten after ACP wraps it as an internal error', async () => {
  const agents = fakeAgents({ resumeError: new Error('no rollout found for thread id saved') })
  const { transport: chat, sessions } = transport(agents, { resume: 'saved', agentDef: codex })
  try {
    await expect(send(chat, 'next')).rejects.toMatchObject({
      cause: { name: 'AgentSessionResumeError', cause: { code: -32603 } }
    })
    expect(sessions).toEqual([null])
    expect(agents.created).toEqual([])
    expect(agents.prompts).toEqual([])
    expect(agents.kills()).toBe(1)
  } finally {
    await chat.destroy()
  }
})

test.each([resuming, codex])(
  'a temporary resume refusal keeps the saved session for $id',
  async (agentDef) => {
    await diagnostics.clear()
    const agents = fakeAgents({ resumeBusy: true })
    const { transport: chat, sessions } = transport(agents, { resume: 'saved', agentDef })
    try {
      await expect(send(chat, 'next')).rejects.toMatchObject({
        message: expect.stringContaining('Try again, or start a new chat.'),
        cause: {
          name: 'AgentSessionRetryError',
          cause: { code: -32600, data: { reason: 'thread_active_writer' } }
        }
      })
      expect(
        (await diagnostics.list()).find((event) => event.name === 'acp.transport.failed')
          ?.attributes
      ).toMatchObject({ errorCode: '-32600' })
      expect(sessions).toEqual([])
      expect(agents.prompts).toEqual([])
      expect(agents.kills()).toBe(1)

      await send(chat, 'next', [message('user', 'earlier'), message('assistant', 'reply')])
      expect(agents.resumed.map((request) => request.sessionId)).toEqual(['saved', 'saved'])
      expect(agents.created).toEqual([])
      expect(agents.prompts).toEqual(['next'])
    } finally {
      await chat.destroy()
    }
  }
)

test('an agent that never answers while starting does not keep the message waiting', async () => {
  const agents = fakeAgents({ answersSessions: false })
  const { transport: chat } = transport(agents, { startTimeoutMs: 20 })
  await expect(send(chat, 'first')).rejects.toBeInstanceOf(Error)
  expect(agents.kills()).toBeGreaterThan(0)
  expect(agents.prompts).toEqual([])
})

test('stopping while the agent starts stops the agent before it gets the message', async () => {
  const agents = fakeAgents({ answersSessions: false })
  const { transport: chat } = transport(agents)
  const stop = new AbortController()
  const sending = send(chat, 'first', [], stop.signal)
  await agents.sessionRequested
  stop.abort()
  await expect(sending).rejects.toBeInstanceOf(Error)
  expect(agents.kills()).toBeGreaterThan(0)
  expect(agents.prompts).toEqual([])
})

test('a reply stopped before the agent starts launches no agent', async () => {
  const agents = fakeAgents()
  const { transport: chat } = transport(agents)
  const stop = new AbortController()
  stop.abort()
  await expect(send(chat, 'first', [], stop.signal)).rejects.toBeInstanceOf(Error)
  expect(agents.spawns()).toBe(0)
  expect(agents.prompts).toEqual([])
})

test('a command lookup that finishes after the deadline launches no agent', async () => {
  const agents = fakeAgents({ lookupWaits: true })
  const { transport: chat } = transport(agents, { startTimeoutMs: 20 })
  await expect(send(chat, 'first')).rejects.toBeInstanceOf(Error)
  agents.finishLookup()
  // A task boundary runs everything the finished lookup queued, including a spawn.
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
  expect(agents.spawns()).toBe(0)
})

test('a session is not saved when its first prompt fails before the agent takes it', async () => {
  const agents = fakeAgents({ turn: 'refused' })
  const { transport: chat, sessions } = transport(agents)
  const reply = await send(chat, 'first')
  expect(agents.prompts).toHaveLength(1)
  expect(reply).toContainEqual(expect.objectContaining({ type: 'error' }))
  expect(reply).toContainEqual({ type: 'finish', finishReason: 'error' })
  expect(sessions).toEqual([])
  await chat.destroy()
})

test('the chat shows what the agent answered, and diagnostics keep only its code', async () => {
  const agents = fakeAgents({ resumeBusy: true })
  const { transport: chat, agentErrors } = transport(agents, { resume: 'saved' })
  try {
    await expect(send(chat, 'next')).rejects.toThrow('Session in use')
    expect(agentErrors).toHaveLength(1)
    expect(diagnosticErrorDetails(agentErrors[0])).toMatchObject({
      errorCode: '-32600',
      message: null,
      stack: null
    })
  } finally {
    await chat.destroy()
  }
})

test("a failed prompt shows the agent's answer, and diagnostics keep only its code", async () => {
  const agents = fakeAgents({ turn: 'refused' })
  const { transport: chat, agentErrors } = transport(agents)
  const reply = await send(chat, 'first')
  expect(reply).toContainEqual({
    type: 'error',
    errorText: 'Internal error'
  })
  expect(agentErrors).toHaveLength(1)
  expect(diagnosticErrorDetails(agentErrors[0])).toMatchObject({
    errorCode: '-32603',
    message: null
  })
  await chat.destroy()
})

test('a session is saved once the agent answers, even when the turn is cut off', async () => {
  const agents = fakeAgents({ turn: 'cut-off' })
  const { transport: chat, sessions } = transport(agents)
  await send(chat, 'first')
  expect(sessions).toEqual(['session-1'])
  await chat.destroy()
})

test('a startup step outside the agent connection is bounded by the deadline too', async () => {
  const agents = fakeAgents({ tokenHangs: true })
  const { transport: chat } = transport(agents, { startTimeoutMs: 20 })
  await expect(send(chat, 'first')).rejects.toBeInstanceOf(Error)
  await agents.killed
  expect(agents.prompts).toEqual([])
})

test('the agent is put on the profile’s model before it gets the first prompt', async () => {
  const agents = fakeAgents({ configOptions: MODEL_OPTIONS })
  const { transport: chat } = transport(agents, { model: 'opus' })
  await send(chat, 'first')
  expect(agents.calls).toEqual(['model opus', 'prompt'])
  await chat.destroy()
})
