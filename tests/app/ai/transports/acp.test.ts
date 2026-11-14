import { expect, test } from 'bun:test'

import type { SessionUpdate } from '@agentclientprotocol/sdk/unstable'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SUBAGENT_PART, subagentTranscript } from '@/app/ai/chat/subagents'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt'
import { restAgents, withSubagent } from '@/app/automation/agents'
import { diagnosticErrorDetails, diagnostics } from '@/app/diagnostics'

import {
  fakeAgents,
  message,
  resuming,
  send,
  sending,
  tick,
  transport
} from '#tests/helpers/ai/acp-agent'

const codex = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'codex'),
  'Codex agent'
)

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

test('a subagent’s work is known by its session and kept in its own transcript', async () => {
  const toolCall = (toolCallId: string): SessionUpdate => ({
    sessionUpdate: 'tool_call',
    toolCallId,
    title: 'mcp__open-pencil__create_shape',
    status: 'pending'
  })
  const agents = fakeAgents({
    updates: [
      { update: { sessionUpdate: 'subagent_update', sessionId: 'subagent-1', title: 'Layout' } },
      {
        session: 'subagent-1',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Mine' } }
      },
      { session: 'subagent-1', update: toolCall('call-inner') },
      // The subagent starts one of its own, which it describes on its session.
      {
        session: 'subagent-1',
        update: { sessionUpdate: 'subagent_update', sessionId: 'subagent-2', title: 'Nested' }
      },
      { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Ours' } } },
      { update: toolCall('call-own') }
    ]
  })
  const { transport: chat } = transport(agents)
  /** The subagent of a call, as OpenPencil's MCP server sees it; `linkTools` names the chat. */
  const subagentOf = (call: string) =>
    withSubagent({ session: 'session-1', kind: 'acp', chat: 'chat', call }).subagent
  try {
    const chunks = await send(chat, 'go')
    expect(agents.capabilities).toMatchObject([{ subagents: {} }])
    expect(subagentOf('call-inner')).toBe('subagent-1')
    expect(subagentOf('call-own')).toBeUndefined()
    // The reply's own text is the agent's; the subagent's is its transcript's.
    const text = chunks.flatMap((chunk) => (chunk.type === 'text-delta' ? [chunk.delta] : []))
    expect(text.join('')).toBe('Ours')
    const transcript = chunks.findLast((chunk) => chunk.type === SUBAGENT_PART)
    expect(
      transcript && 'data' in transcript
        ? subagentTranscript({ type: SUBAGENT_PART, data: transcript.data })
        : null
    ).toMatchObject({
      session: 'subagent-1',
      title: 'Layout',
      parts: expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Mine' })])
    })
    const nested = chunks.findLast(
      (chunk) => chunk.type === SUBAGENT_PART && 'id' in chunk && chunk.id === 'subagent-2'
    )
    expect(
      nested && 'data' in nested
        ? subagentTranscript({ type: SUBAGENT_PART, data: nested.data })
        : null
    ).toMatchObject({ session: 'subagent-2', title: 'Nested' })
  } finally {
    restAgents('acp')
    await chat.destroy()
  }
})

test('the reply ends with an error when the agent exits mid-prompt', async () => {
  const agents = fakeAgents({ turn: 'held' })
  const { transport: chat } = transport(agents)
  const reply = sending(chat, 'first')
  await agents.promptTaken
  await agents.say({
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'On it' }
  })
  agents.crash()
  await reply.ended
  expect(reply.chunks.map((chunk) => chunk.type)).toContain('text-end')
  expect(reply.chunks).toContainEqual({
    type: 'error',
    errorText: 'Agent process exited unexpectedly.'
  })
  expect(reply.chunks.at(-1)).toEqual({ type: 'finish', finishReason: 'error' })
  await chat.destroy()
})

test("a reply nobody reads any more cancels the agent's turn", async () => {
  const agents = fakeAgents({ turn: 'held' })
  const { transport: chat, agentErrors } = transport(agents)
  const reply = await chat.sendMessages({
    trigger: 'submit-message',
    chatId: 'chat',
    messageId: undefined,
    messages: [message('user', 'first')],
    abortSignal: undefined
  })
  await agents.promptTaken
  // As when the chat cannot process a chunk: its reader goes away without a Stop.
  await reply.cancel()
  await tick()
  expect(agents.cancels).toEqual(['session-1'])
  expect(agentErrors).toEqual([])
  await chat.destroy()
})

test('closing the chat ends its reply without reporting the agent as failed', async () => {
  const agents = fakeAgents({ turn: 'held' })
  const { transport: chat, agentErrors } = transport(agents)
  const reply = sending(chat, 'first')
  await agents.promptTaken
  await chat.destroy()
  await reply.ended
  expect(reply.chunks.some((chunk) => chunk.type === 'error')).toBe(false)
  expect(reply.chunks.at(-1)).toEqual({ type: 'finish', finishReason: 'stop' })
  expect(agentErrors).toEqual([])
})
