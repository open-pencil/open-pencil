import { describe, expect, mock, test } from 'bun:test'

import { ACP_AGENTS, type ACPAgentDef } from '@open-pencil/core/constants'

import type { AgentAuthCheck } from '@/app/ai/agents/acp/auth/session'
import type { AgentAuthStatus } from '@/app/ai/agents/acp/auth/status'
import type { TerminalSignIn } from '@/app/ai/agents/acp/auth/terminal'
import { createAgentAccounts } from '@/app/ai/agents/setup/accounts'
import { createDeferred } from '@/app/runtime/deferred'

import { expectDefined } from '#tests/helpers/assert'

const claude = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'claude-code'),
  'Claude Code'
)
const codex = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'codex'),
  'Codex'
)

const SIGNED_OUT: AgentAuthStatus = { kind: 'none', label: 'Not logged in' }
const CLAUDE_MAX: AgentAuthStatus = {
  kind: 'account',
  label: 'Claude Max',
  account: { email: 'designer@example.com' }
}
const ADAPTER = { name: '@agentclientprotocol/claude-agent-acp', version: '0.93.0' }

function signedOut(): AgentAuthCheck {
  return {
    status: SIGNED_OUT,
    adapter: ADAPTER,
    tools: null,
    methods: [
      { id: 'claude-ai-login', name: 'Claude Subscription', type: 'terminal' },
      { id: 'chat-gpt', name: 'ChatGPT' }
    ]
  }
}

function accountsWith(
  checks: AgentAuthCheck[],
  overrides: Partial<Parameters<typeof createAgentAccounts>[0]> = {}
) {
  const check = mock(async (_agent: ACPAgentDef) => expectDefined(checks.shift(), 'check'))
  const accounts = createAgentAccounts({
    enabled: true,
    check,
    signInWithAgent: async () => null,
    startTerminalSignIn: async () => {
      throw new Error('Not expected')
    },
    ...overrides
  })
  return { accounts, check }
}

describe('agent accounts', () => {
  test('records the login an agent reports and whether setup can sign in to it', async () => {
    const { accounts } = accountsWith([signedOut()])
    expect(accounts.account('claude-code').status).toBeUndefined()
    const checking = accounts.check(claude)
    expect(accounts.account('claude-code').checking).toBe(true)
    await checking
    expect(accounts.account('claude-code')).toMatchObject({
      checking: false,
      status: SIGNED_OUT,
      adapter: ADAPTER,
      canSignIn: true,
      error: null
    })
  })

  test('offers no sign-in when the agent lacks the method setup uses', async () => {
    const { accounts } = accountsWith([
      { status: SIGNED_OUT, adapter: null, methods: [], tools: null }
    ])
    await accounts.check(codex)
    expect(accounts.account('codex').canSignIn).toBe(false)
    await accounts.signIn(codex)
    expect(accounts.account('codex').error).toBe('sign-in')
  })

  test('joins a check that is already running', async () => {
    const { accounts, check } = accountsWith([signedOut()])
    await Promise.all([accounts.check(claude), accounts.check(claude)])
    expect(check).toHaveBeenCalledTimes(1)
  })

  test('marks a check that could not start the agent', async () => {
    const accounts = createAgentAccounts({
      enabled: true,
      check: async () => {
        throw new Error('spawn failed')
      },
      signInWithAgent: async () => null,
      startTerminalSignIn: async () => {
        throw new Error('Not expected')
      }
    })
    await accounts.check(claude)
    expect(accounts.account('claude-code')).toMatchObject({ checking: false, error: 'check' })
  })

  test('signs in through the terminal login, then reads the new login from the agent', async () => {
    const exited = createDeferred<undefined>()
    const submitCode = mock(async (_code: string) => undefined)
    const startTerminalSignIn = mock(
      async (_agent: ACPAgentDef, _args: string[], onURL: (url: string) => void) => {
        onURL('https://claude.com/sign-in')
        const login: TerminalSignIn = {
          done: exited.promise,
          submitCode,
          cancel: async () => undefined
        }
        return login
      }
    )
    const { accounts } = accountsWith([signedOut(), { ...signedOut(), status: CLAUDE_MAX }], {
      startTerminalSignIn
    })
    await accounts.check(claude)
    const signingIn = accounts.signIn(claude)
    await Bun.sleep(0)
    expect(startTerminalSignIn.mock.calls[0]?.[1]).toEqual(['--cli', 'auth', 'login', '--claudeai'])
    expect(accounts.account('claude-code')).toMatchObject({
      signingIn: true,
      signInURL: 'https://claude.com/sign-in',
      acceptsCode: true
    })
    await accounts.submitCode('claude-code', 'abc')
    expect(submitCode).toHaveBeenCalledWith('abc')
    exited.resolve(undefined)
    await signingIn
    expect(accounts.account('claude-code')).toMatchObject({
      signingIn: false,
      signInURL: null,
      status: CLAUDE_MAX,
      error: null
    })
  })

  test('signs in through a method the agent runs itself', async () => {
    const chatGPT: AgentAuthStatus = { kind: 'account', label: 'ChatGPT Pro' }
    const signInWithAgent = mock(async (_agent: ACPAgentDef, _method: string) => chatGPT)
    const codexSignedOut = { ...signedOut(), adapter: null }
    const { accounts } = accountsWith([codexSignedOut, { ...codexSignedOut, status: chatGPT }], {
      signInWithAgent
    })
    await accounts.signIn(codex)
    expect(signInWithAgent.mock.calls[0]?.[1]).toBe('chat-gpt')
    expect(accounts.account('codex')).toMatchObject({ signingIn: false, status: chatGPT })
  })

  test('a cancelled sign-in is not a failure and does not check again', async () => {
    const { accounts, check } = accountsWith([signedOut()], {
      signInWithAgent: (_agent, _method, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')))
        })
    })
    await accounts.check(codex)
    const signingIn = accounts.signIn(codex)
    await Bun.sleep(0)
    await accounts.cancelSignIn('codex')
    await signingIn
    expect(accounts.account('codex')).toMatchObject({ signingIn: false, error: null })
    expect(check).toHaveBeenCalledTimes(1)
  })

  test('a failed sign-in keeps the last known login', async () => {
    const { accounts } = accountsWith([signedOut()], {
      startTerminalSignIn: async () => ({
        done: Promise.reject(new Error('exit 1')),
        submitCode: async () => undefined,
        cancel: async () => undefined
      })
    })
    await accounts.check(claude)
    await accounts.signIn(claude)
    expect(accounts.account('claude-code')).toMatchObject({ status: SIGNED_OUT, error: 'sign-in' })
  })

  test('takes logins the agent reports during a chat', () => {
    const { accounts } = accountsWith([])
    accounts.report('claude-code', CLAUDE_MAX)
    expect(accounts.account('claude-code').status).toEqual(CLAUDE_MAX)
  })

  test('starts nothing where agents cannot run', async () => {
    const check = mock(async () => signedOut())
    const accounts = createAgentAccounts({
      enabled: false,
      check,
      signInWithAgent: async () => null,
      startTerminalSignIn: async () => {
        throw new Error('Not expected')
      }
    })
    await accounts.check(claude)
    await accounts.signIn(claude)
    expect(check).not.toHaveBeenCalled()
    expect(accounts.account('claude-code').status).toBeUndefined()
  })
})
