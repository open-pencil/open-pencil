import { expect, test } from 'bun:test'

import type {
  InitializeResponse,
  NewSessionRequest,
  ResumeSessionRequest
} from '@agentclientprotocol/sdk'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import {
  AgentSessionResumeError,
  openAgentSession,
  resumingAgent
} from '@/app/ai/agents/acp/session'
import { OWN_TOOLS_ALLOWED } from '@/app/ai/agents/acp/tools'
const resuming = expectDefined(
  ACP_AGENTS.find((agent) => agent.resumesSessions),
  'an agent that resumes sessions'
)
const notResuming = expectDefined(
  ACP_AGENTS.find((agent) => !agent.resumesSessions),
  'an agent that does not resume sessions'
)

const resumes: InitializeResponse = {
  protocolVersion: 1,
  agentCapabilities: { sessionCapabilities: { resume: {} } }
}
const request = { cwd: '/workspace', mcpServers: [], meta: OWN_TOOLS_ALLOWED }

interface FakeConnectionOptions {
  resumeError?: Error
}

function connection({ resumeError }: FakeConnectionOptions = {}) {
  const created: NewSessionRequest[] = []
  const resumed: ResumeSessionRequest[] = []
  return {
    created,
    resumed,
    async newSession(params: NewSessionRequest) {
      created.push(params)
      return { sessionId: 'new-session', models: { currentModelId: 'opus', availableModels: [] } }
    },
    async unstable_resumeSession(params: ResumeSessionRequest) {
      resumed.push(params)
      if (resumeError) throw resumeError
      return { models: { currentModelId: 'sonnet', availableModels: [] } }
    }
  }
}

test('only agents that resume sessions continue saved chats', () => {
  expect(resumingAgent(`acp:${resuming.id}`)).toBe(resuming.id)
  expect(resumingAgent('acp:claude-code')).toBe('claude-code')
  expect(resumingAgent('acp:codex')).toBe('codex')
  expect(resumingAgent(`acp:${notResuming.id}`)).toBeNull()
  expect(resumingAgent('anthropic')).toBeNull()
})

test('a chat without a saved session starts a new one', async () => {
  const fake = connection()
  const opened = await openAgentSession(fake, resuming, resumes, { ...request, resume: null })
  expect(opened).toEqual({ sessionId: 'new-session', model: 'opus', resumed: false })
  expect(fake.created).toEqual([{ cwd: '/workspace', mcpServers: [], _meta: OWN_TOOLS_ALLOWED }])
  expect(fake.resumed).toEqual([])
})

test('a saved session resumes with the same folder and OpenPencil tools', async () => {
  const fake = connection()
  const opened = await openAgentSession(fake, resuming, resumes, { ...request, resume: 'saved' })
  expect(opened).toEqual({ sessionId: 'saved', model: 'sonnet', resumed: true })
  expect(fake.resumed).toEqual([
    { sessionId: 'saved', cwd: '/workspace', mcpServers: [], _meta: OWN_TOOLS_ALLOWED }
  ])
  expect(fake.created).toEqual([])
})

test('a saved session never silently becomes a new one', async () => {
  const withoutCapability = connection()
  const noResume: InitializeResponse = { protocolVersion: 1 }
  await expect(
    openAgentSession(withoutCapability, resuming, noResume, { ...request, resume: 's' })
  ).rejects.toBeInstanceOf(AgentSessionResumeError)
  await expect(
    openAgentSession(withoutCapability, notResuming, resumes, { ...request, resume: 's' })
  ).rejects.toBeInstanceOf(AgentSessionResumeError)
  expect(withoutCapability.created).toEqual([])
  expect(withoutCapability.resumed).toEqual([])

  const unknownSession = new Error('No conversation found')
  const missing = connection({ resumeError: unknownSession })
  const failure = await openAgentSession(missing, resuming, resumes, {
    ...request,
    resume: 's'
  }).catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(AgentSessionResumeError)
  expect(failure).not.toBe(unknownSession)
  expect(failure instanceof Error && failure.cause).toBe(unknownSession)
  expect(missing.created).toEqual([])
})

test('a resume that needs sign-in keeps the sign-in error', async () => {
  const authRequired = Object.assign(new Error('Authentication required'), { code: -32000 })
  const fake = connection({ resumeError: authRequired })
  await expect(openAgentSession(fake, resuming, resumes, { ...request, resume: 's' })).rejects.toBe(
    authRequired
  )
})
