import { describe, expect, test } from 'bun:test'

import {
  AgentSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type Agent,
  type InitializeRequest,
  type NewSessionRequest
} from '@agentclientprotocol/sdk'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import {
  checkAgentAuth,
  signInWithAgent,
  type AgentStreams,
  type ToolsProbe
} from '@/app/ai/agents/acp/auth/session'
import { AUTH_STATUS_UPDATE_METHOD, type AgentAuthStatus } from '@/app/ai/agents/acp/auth/status'
import type { OwnToolsOutcome } from '@/app/ai/agents/acp/tools'
import { createDeferred } from '@/app/runtime/deferred'

import { expectDefined } from '#tests/helpers/assert'

const codex = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'codex'),
  'Codex'
)

const SIGNED_OUT: AgentAuthStatus = { kind: 'none', label: 'Not logged in' }
const SIGNED_IN: AgentAuthStatus = {
  kind: 'account',
  label: 'ChatGPT Pro',
  account: { email: 'designer@example.com', plan: 'pro' }
}

/** An in-memory ACP agent that reports a login the way Claude's and Codex's adapters do. */
function fakeAgent(options: {
  /** Pushed after `initialize` answers; nothing when absent. */
  status?: AgentAuthStatus
  /** Pushed after `authenticate` finishes; `authenticate` never finishes when absent. */
  afterSignIn?: AgentAuthStatus
  /** False for an agent that starts but never answers `initialize`. */
  answersInitialize?: boolean
  /** Starts sessions, recording each request, instead of refusing them. */
  startsSessions?: boolean
}) {
  const toAgent = new TransformStream<Uint8Array, Uint8Array>()
  const toClient = new TransformStream<Uint8Array, Uint8Array>()
  const initialized: InitializeRequest[] = []
  const sessions: NewSessionRequest[] = []
  const closed = createDeferred<undefined>()
  const authenticating = createDeferred<undefined>()
  let connection: AgentSideConnection | null = null
  const push = (status: AgentAuthStatus) =>
    void connection?.extNotification(AUTH_STATUS_UPDATE_METHOD, { authStatus: status })
  const agent: Agent = {
    async initialize(params) {
      initialized.push(params)
      if (options.answersInitialize === false) return createDeferred<never>().promise
      if (options.status) {
        const status = options.status
        setTimeout(() => push(status), 5)
      }
      return {
        protocolVersion: PROTOCOL_VERSION,
        agentInfo: { name: '@agentclientprotocol/codex-acp', version: '2.2.2' },
        authMethods: [
          { id: 'chat-gpt', name: 'ChatGPT' },
          { id: 'claude-ai-login', name: 'Claude Subscription', type: 'terminal', args: ['login'] },
          { name: 'Missing id' }
        ]
      } as Awaited<ReturnType<Agent['initialize']>>
    },
    async newSession(params) {
      if (!options.startsSessions) throw new Error('Not used')
      sessions.push(params)
      return { sessionId: `session-${sessions.length}` }
    },
    async authenticate() {
      authenticating.resolve(undefined)
      // Without a login to report, the sign-in waits as an unfinished browser login does.
      if (!options.afterSignIn) return createDeferred<never>().promise
      // Reported after the answer, so the sign-in must wait past `authenticate` for it.
      const status = options.afterSignIn
      setTimeout(() => push(status), 5)
      return {}
    },
    async prompt() {
      throw new Error('Not used')
    },
    cancel: async () => undefined
  }
  connection = new AgentSideConnection(
    () => agent,
    ndJsonStream(toClient.writable, toAgent.readable)
  )
  // Ending the pipe ends what the client reads, as a killed process does.
  const output = new TransformStream<Uint8Array, Uint8Array>()
  const stop = new AbortController()
  toClient.readable
    .pipeTo(output.writable, { signal: stop.signal, preventCancel: true })
    .catch(() => undefined)
  const streams: AgentStreams = {
    input: toAgent.writable,
    output: output.readable,
    async close() {
      stop.abort()
      closed.resolve(undefined)
    }
  }
  return {
    spawn: async () => streams,
    initialized,
    sessions,
    closed: closed.promise,
    authenticating: authenticating.promise
  }
}

describe('checkAgentAuth', () => {
  test('reads the login an agent reports after initialize, then stops it', async () => {
    const agent = fakeAgent({ status: SIGNED_IN })
    const result = await checkAgentAuth(codex, { spawn: agent.spawn })
    expect(result.status).toEqual(SIGNED_IN)
    expect(result.adapter).toEqual({ name: '@agentclientprotocol/codex-acp', version: '2.2.2' })
    expect(result.methods).toEqual([
      { id: 'chat-gpt', name: 'ChatGPT' },
      { id: 'claude-ai-login', name: 'Claude Subscription', type: 'terminal' }
    ])
    await agent.closed
  })

  test('asks for terminal sign-in methods, which Claude offers only to clients that run them', async () => {
    const agent = fakeAgent({ status: SIGNED_OUT })
    await checkAgentAuth(codex, { spawn: agent.spawn })
    expect(agent.initialized[0]?.clientCapabilities?._meta).toEqual({ 'terminal-auth': true })
  })

  test('stops an agent that never answers initialize', async () => {
    const agent = fakeAgent({ answersInitialize: false })
    await expect(
      checkAgentAuth(codex, { spawn: agent.spawn, initializeTimeoutMs: 20 })
    ).rejects.toThrow('The agent did not start.')
    await agent.closed
  })

  test('reports an unknown login when the agent says nothing in time', async () => {
    const agent = fakeAgent({})
    const result = await checkAgentAuth(codex, { spawn: agent.spawn, statusTimeoutMs: 20 })
    expect(result.status).toBeNull()
    await agent.closed
  })
})

describe('signInWithAgent', () => {
  test('returns the login the agent reports once authenticate finishes', async () => {
    const agent = fakeAgent({ status: SIGNED_OUT, afterSignIn: SIGNED_IN })
    const status = await signInWithAgent(codex, 'chat-gpt', new AbortController().signal, {
      spawn: agent.spawn
    })
    expect(status).toEqual(SIGNED_IN)
    await agent.closed
  })

  test('stops the agent when the sign-in is cancelled', async () => {
    const agent = fakeAgent({ status: SIGNED_OUT })
    const controller = new AbortController()
    const signIn = signInWithAgent(codex, 'chat-gpt', controller.signal, { spawn: agent.spawn })
    await agent.authenticating
    controller.abort()
    await expect(signIn).rejects.toThrow()
    await agent.closed
  })
})

/** A link to OpenPencil's tools that reports the given outcome once the session exists. */
function toolsProbe(outcome: OwnToolsOutcome) {
  const linked: string[] = []
  const probe: ToolsProbe = {
    cwd: async () => '/workspace',
    link: async () => {
      linked.push('link')
      return {
        chat: '0123456789abcdef',
        mcpServers: [
          { type: 'http', name: 'open-pencil', url: 'http://127.0.0.1:7600/mcp', headers: [] }
        ],
        meta: { claudeCode: { options: { allowedTools: ['mcp__open-pencil'] } } },
        noteUpdate: () => undefined,
        outcome: async () => outcome,
        stop: () => undefined
      }
    }
  }
  return { probe, linked }
}

describe("checking a signed-in agent reaches OpenPencil's tools", () => {
  test('starts a session as a chat does, sends no prompt, and reports the outcome', async () => {
    const agent = fakeAgent({ status: SIGNED_IN, startsSessions: true })
    const { probe } = toolsProbe({ connected: true })
    const result = await checkAgentAuth(codex, { spawn: agent.spawn, tools: probe })
    expect(result.tools).toEqual({ connected: true })
    expect(agent.sessions).toHaveLength(1)
    expect(agent.sessions[0]).toMatchObject({
      cwd: '/workspace',
      mcpServers: [{ name: 'open-pencil' }],
      _meta: { claudeCode: { options: { allowedTools: ['mcp__open-pencil'] } } }
    })
    await agent.closed
  })

  test('leaves a signed-out agent unchecked', async () => {
    const agent = fakeAgent({ status: SIGNED_OUT, startsSessions: true })
    const { probe, linked } = toolsProbe({ connected: true })
    const result = await checkAgentAuth(codex, { spawn: agent.spawn, tools: probe })
    expect(result.tools).toBeNull()
    expect(linked).toEqual([])
    expect(agent.sessions).toHaveLength(0)
    await agent.closed
  })

  test('keeps the login when linking to the tools fails, as with the MCP server down', async () => {
    const agent = fakeAgent({ status: SIGNED_IN, startsSessions: true })
    const probe: ToolsProbe = {
      cwd: async () => '/workspace',
      link: async () => {
        throw new Error('MCP server is not running')
      }
    }
    const result = await checkAgentAuth(codex, { spawn: agent.spawn, tools: probe })
    expect(result.status).toEqual(SIGNED_IN)
    expect(result.tools).toEqual({ connected: false, reason: 'MCP server is not running' })
    expect(agent.sessions).toHaveLength(0)
    await agent.closed
  })

  test('a session the agent refuses counts as unreachable, with its reason', async () => {
    const agent = fakeAgent({ status: SIGNED_IN })
    const { probe } = toolsProbe({ connected: true })
    const result = await checkAgentAuth(codex, { spawn: agent.spawn, tools: probe })
    expect(result.tools).toMatchObject({ connected: false })
    expect(result.tools && 'reason' in result.tools ? result.tools.reason : null).toBeString()
    await agent.closed
  })
})
