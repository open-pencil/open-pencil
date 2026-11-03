import { expect, test } from 'bun:test'

import {
  AgentSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type Agent,
  type NewSessionRequest,
  type ResumeSessionRequest
} from '@agentclientprotocol/sdk'
import type { UIMessage } from 'ai'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { OWN_TOOLS_ALLOWED } from '@/app/ai/agents/acp/tools'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt'
import { ACPChatTransport, type ACPStartup } from '@/app/ai/transports/acp'
import { createDeferred } from '@/app/runtime/deferred'

import { expectDefined } from '#tests/helpers/assert'

const resuming = expectDefined(
  ACP_AGENTS.find((agent) => agent.resumesSessions),
  'an agent that resumes sessions'
)

interface FakeAgentOptions {
  /** False for an agent that runs but never answers a new session. */
  answersSessions?: boolean
  /** Refuses every resume, as for a session the agent no longer has. */
  resumeFails?: boolean
  /** True for an automation token that is never read, as with a credential prompt left open. */
  tokenHangs?: boolean
  /**
   * How the agent's turn ends: `refused` fails before the agent takes the prompt, `cut-off` fails
   * after it started answering. Either way it first sends updates that are not part of a turn.
   */
  turn?: 'answered' | 'refused' | 'cut-off'
}

/** In-memory ACP agents, one per start, that record what the transport asks of them. */
function fakeAgents({
  answersSessions = true,
  resumeFails = false,
  tokenHangs = false,
  turn = 'answered'
}: FakeAgentOptions = {}) {
  const prompts: string[] = []
  const created: NewSessionRequest[] = []
  const resumed: ResumeSessionRequest[] = []
  const sessionRequested = createDeferred<undefined>()
  const killed = createDeferred<undefined>()
  let kills = 0
  let spawns = 0
  let crashLatest: (() => void) | null = null

  const spawn: ACPStartup['spawn'] = async (options) => {
    spawns++
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
        return { sessionId: `session-${created.length}` }
      },
      async unstable_resumeSession(params) {
        resumed.push(params)
        if (resumeFails) throw new Error('No conversation found')
        return {}
      },
      async prompt(params) {
        const [part] = params.prompt
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
    resolveCommand: async (agent) => agent.command,
    spawn,
    authToken: async () => (tokenHangs ? createDeferred<never>().promise : null),
    linkTools: async () => ({
      chat: 'chat',
      mcpServers: [],
      meta: OWN_TOOLS_ALLOWED,
      noteUpdate: () => undefined,
      outcome: async () => ({ connected: true }),
      stop: () => undefined
    })
  }
  return {
    startup,
    prompts,
    created,
    resumed,
    sessionRequested: sessionRequested.promise,
    killed: killed.promise,
    kills: () => kills,
    spawns: () => spawns,
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
): Promise<void> {
  const reply = await transport.sendMessages({
    trigger: 'submit-message',
    chatId: 'chat',
    messageId: undefined,
    messages: [...history, message('user', text)],
    abortSignal
  })
  await reply.pipeTo(new WritableStream())
}

function transport(
  agents: ReturnType<typeof fakeAgents>,
  options: { resume?: string; startTimeoutMs?: number } = {}
) {
  const sessions: (string | null)[] = []
  const created = new ACPChatTransport({
    agentDef: resuming,
    startup: agents.startup,
    resume: options.resume,
    startTimeoutMs: options.startTimeoutMs ?? 1_000,
    onSession: (id) => sessions.push(id)
  })
  return { transport: created, sessions }
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
  const agents = fakeAgents({ resumeFails: true })
  const { transport: chat, sessions } = transport(agents, { resume: 'saved' })
  await expect(send(chat, 'next')).rejects.toBeInstanceOf(Error)
  expect(sessions).toEqual([null])
  expect(agents.created).toEqual([])
  expect(agents.prompts).toEqual([])
})

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

test('a session is not saved when its first prompt fails before the agent takes it', async () => {
  const agents = fakeAgents({ turn: 'refused' })
  const { transport: chat, sessions } = transport(agents)
  await send(chat, 'first')
  expect(agents.prompts).toHaveLength(1)
  expect(sessions).toEqual([])
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
