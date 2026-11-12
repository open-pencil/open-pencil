import { expect, test } from 'bun:test'

import {
  RequestError,
  type InitializeResponse,
  type NewSessionRequest,
  type ResumeSessionRequest,
  type SetSessionConfigOptionRequest,
  type SetSessionModelRequest
} from '@agentclientprotocol/sdk'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import type { OfferedModels } from '@/app/ai/agents/acp/models'
import {
  AgentSessionResumeError,
  AgentSessionRetryError,
  openAgentSession,
  resumingAgent
} from '@/app/ai/agents/acp/session'
import { OWN_TOOLS_ALLOWED } from '@/app/ai/agents/acp/tools'

import { MODEL_OPTIONS } from '#tests/helpers/ai/fake-acp-agent'

const resuming = expectDefined(
  ACP_AGENTS.find((agent) => agent.resumesSessions),
  'an agent that resumes sessions'
)
const notResuming = expectDefined(
  ACP_AGENTS.find((agent) => !agent.resumesSessions),
  'an agent that does not resume sessions'
)
const codex = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'codex'),
  'Codex agent'
)
const claude = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'claude-code'),
  'Claude agent'
)

const resumes: InitializeResponse = {
  protocolVersion: 1,
  agentCapabilities: { sessionCapabilities: { resume: {} } }
}
const request = { cwd: '/workspace', mcpServers: [], meta: OWN_TOOLS_ALLOWED, model: '' }

interface FakeConnectionOptions {
  resumeError?: unknown
  offered?: OfferedModels
}

function connection({ resumeError, offered }: FakeConnectionOptions = {}) {
  const created: NewSessionRequest[] = []
  const resumed: ResumeSessionRequest[] = []
  const configured: SetSessionConfigOptionRequest[] = []
  const switched: SetSessionModelRequest[] = []
  return {
    created,
    resumed,
    configured,
    switched,
    async newSession(params: NewSessionRequest) {
      created.push(params)
      return {
        sessionId: 'new-session',
        models: { currentModelId: 'opus', availableModels: [] },
        ...offered
      }
    },
    async unstable_resumeSession(params: ResumeSessionRequest) {
      resumed.push(params)
      if (resumeError !== undefined) throw resumeError
      return { models: { currentModelId: 'sonnet', availableModels: [] }, ...offered }
    },
    async setSessionConfigOption(params: SetSessionConfigOptionRequest) {
      configured.push(params)
      return { configOptions: [] }
    },
    async unstable_setSessionModel(params: SetSessionModelRequest) {
      switched.push(params)
      return {}
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

test('a new session switches to the profile’s model through the agent’s model option', async () => {
  const fake = connection({ offered: { configOptions: MODEL_OPTIONS } })
  const opened = await openAgentSession(fake, claude, resumes, {
    ...request,
    model: 'opus',
    resume: null
  })
  expect(fake.configured).toEqual([{ sessionId: 'new-session', configId: 'model', value: 'opus' }])
  expect(opened).toMatchObject({ sessionId: 'new-session', model: 'opus' })
})

test('a session keeps the agent’s own model when the profile names none or the same', async () => {
  const fake = connection({ offered: { configOptions: MODEL_OPTIONS } })
  await openAgentSession(fake, claude, resumes, { ...request, resume: null })
  await openAgentSession(fake, claude, resumes, { ...request, model: 'default', resume: null })
  expect(fake.configured).toEqual([])
  expect(fake.switched).toEqual([])
})

test('an agent that lists only session models is switched through them', async () => {
  const fake = connection({
    offered: {
      configOptions: null,
      models: {
        currentModelId: 'fast',
        availableModels: [
          { modelId: 'fast', name: 'Fast' },
          { modelId: 'deep', name: 'Deep' }
        ]
      }
    }
  })
  const opened = await openAgentSession(fake, claude, resumes, {
    ...request,
    model: 'deep',
    resume: null
  })
  expect(fake.switched).toEqual([{ sessionId: 'new-session', modelId: 'deep' }])
  expect(fake.configured).toEqual([])
  expect(opened.model).toBe('deep')
})

test('a saved session is switched to the profile’s model as well', async () => {
  const fake = connection({ offered: { configOptions: MODEL_OPTIONS } })
  await openAgentSession(fake, resuming, resumes, { ...request, model: 'opus', resume: 'saved' })
  expect(fake.configured).toEqual([{ sessionId: 'saved', configId: 'model', value: 'opus' }])
})

test('an agent that offers no choice of model refuses a profile that names one', async () => {
  const fake = connection({ offered: { configOptions: null, models: null } })
  await expect(
    openAgentSession(fake, claude, resumes, { ...request, model: 'opus', resume: null })
  ).rejects.toThrow(claude.name)
  expect(fake.configured).toEqual([])
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

  const unknownSession = RequestError.resourceNotFound('s')
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

test.each([
  RequestError.internalError({ details: 'no rollout found for thread id saved' }),
  { code: -32603, message: 'no rollout found for thread id saved' },
  {
    code: -32603,
    message: 'Internal error',
    data: { details: 'no rollout found for thread id saved' }
  }
])('a missing Codex rollout retires the saved session: %j', async (resumeError) => {
  const fake = connection({ resumeError })
  const failure = await openAgentSession(fake, codex, resumes, {
    ...request,
    resume: 'saved'
  }).catch((cause: unknown) => cause)
  expect(failure).toBeInstanceOf(AgentSessionResumeError)
  expect(failure instanceof Error && failure.cause).toBe(resumeError)
  expect(fake.created).toEqual([])
})

test.each([
  RequestError.internalError(),
  RequestError.internalError({ details: 'thread saved already has an active writer' }),
  RequestError.internalError({ details: 'thread not loaded: saved' }),
  RequestError.internalError({ details: ['no rollout found for thread id saved'] }),
  RequestError.invalidRequest({ reason: 'thread_active_writer' }, 'Session in use'),
  { code: '-32603', message: 'no rollout found for thread id saved' }
])('other Codex resume errors remain retryable: %j', async (error) => {
  const fake = connection({ resumeError: error })
  await expectRetry(openAgentSession(fake, codex, resumes, { ...request, resume: 'saved' }), error)
  expect(fake.created).toEqual([])
})

test('Codex error wording does not classify another agent’s internal error', async () => {
  const error = RequestError.internalError({ details: 'no rollout found for thread id saved' })
  const fake = connection({ resumeError: error })
  await expectRetry(openAgentSession(fake, claude, resumes, { ...request, resume: 'saved' }), error)
})

test.each([
  RequestError.invalidRequest({ reason: 'thread_active_writer' }, 'Session in use'),
  RequestError.internalError(),
  new Error('Connection closed')
])(
  'an unconfirmed resume failure offers a retry and keeps the agent’s error: %s',
  async (error) => {
    const fake = connection({ resumeError: error })
    await expectRetry(openAgentSession(fake, resuming, resumes, { ...request, resume: 's' }), error)
    expect(fake.created).toEqual([])
  }
)

/** A failure the conversation can retry, which names both ways on and keeps what the agent said. */
async function expectRetry(opening: Promise<unknown>, error: unknown) {
  const failure = await opening.catch((cause: unknown) => cause)
  expect(failure).toBeInstanceOf(AgentSessionRetryError)
  expect(failure instanceof Error && failure.cause).toBe(error)
  expect(failure instanceof Error && failure.message).toContain('Try again, or start a new chat.')
}
