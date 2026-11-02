import { describe, expect, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import type { AgentAccount } from '@/app/ai/agents/setup/accounts'
import { codingAgentDetection, piDetection } from '@/app/ai/agents/setup/detection'
import type { DetectedAgent } from '@/app/ai/agents/setup/discovery'
import type { AgentSetupState, PiSetupState } from '@/app/ai/agents/setup/view'

import { expectDefined } from '#tests/helpers/assert'

const claude = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'claude-code'),
  'Claude Code'
)

function detected(status: DetectedAgent['status'], cliPath: string | null = null): DetectedAgent {
  return {
    definition: claude,
    status,
    cliPath,
    adapterPath: status === 'available' ? '/bin/a' : null
  }
}

function account(overrides: Partial<AgentAccount>): AgentAccount {
  return {
    checking: false,
    status: undefined,
    adapter: { name: '@agentclientprotocol/claude-agent-acp', version: '0.93.0' },
    canSignIn: true,
    signingIn: false,
    signInURL: null,
    acceptsCode: false,
    tools: null,
    error: null,
    ...overrides
  }
}

function setup(overrides: Partial<AgentSetupState>): AgentSetupState {
  return {
    supported: true,
    checked: true,
    scanning: false,
    detected: null,
    bridge: true,
    bridgeOutdated: false,
    bridgeCommand: '',
    npm: true,
    installingAgent: false,
    installingBridge: false,
    error: null,
    ...overrides
  }
}

describe('codingAgentDetection', () => {
  test('is checking until the first lookup and account check finish', () => {
    expect(codingAgentDetection(claude, setup({ checked: false }))).toEqual({ state: 'checking' })
    expect(
      codingAgentDetection(
        claude,
        setup({ detected: detected('available'), account: account({ checking: true }) })
      )
    ).toEqual({ state: 'checking' })
  })

  test('names the account a signed-in agent uses', () => {
    const status = { kind: 'account' as const, label: 'Claude Max', account: { email: 'a@b.c' } }
    expect(
      codingAgentDetection(
        claude,
        setup({ detected: detected('available'), account: account({ status }) })
      )
    ).toEqual({ state: 'signed-in', account: 'Claude Max · a@b.c' })
  })

  test('tells a signed-out agent from one that is not there', () => {
    const signedOut = { kind: 'none' as const, label: 'Not logged in' }
    expect(
      codingAgentDetection(
        claude,
        setup({ detected: detected('available'), account: account({ status: signedOut }) })
      )
    ).toEqual({ state: 'signed-out' })
    expect(codingAgentDetection(claude, setup({ detected: detected('needs-adapter') }))).toEqual({
      state: 'not-found'
    })
  })

  test('counts the agent’s own CLI as found before its adapter is installed', () => {
    expect(
      codingAgentDetection(claude, setup({ detected: detected('needs-adapter', '/bin/claude') }))
    ).toEqual({ state: 'found' })
  })
})

describe('piDetection', () => {
  const pi = (overrides: Partial<PiSetupState>): PiSetupState => ({
    supported: true,
    checked: true,
    scanning: false,
    companion: false,
    companionOutdated: false,
    companionCommand: '',
    bridge: true,
    bridgeOutdated: false,
    bridgeCommand: '',
    npm: true,
    installingCompanion: false,
    installingBridge: false,
    defaultModel: null,
    error: null,
    ...overrides
  })

  test('reports Pi’s sign-ins without naming its default model as an account', () => {
    expect(piDetection(pi({ signedIn: true, defaultModel: 'openai-codex/gpt-6' }))).toEqual({
      state: 'signed-in',
      account: null
    })
    expect(piDetection(pi({ companion: true }))).toEqual({ state: 'found' })
    expect(piDetection(pi({}))).toEqual({ state: 'not-found' })
  })
})
