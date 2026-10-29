import { describe, expect, test } from 'bun:test'

import type { AgentDetection } from '@/app/ai/agents/setup/detection'
import { modelConnectionState, type ModelConnectionInput } from '@/app/ai/models/settings/status'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'

function state(overrides: Partial<ModelConnectionInput>) {
  return modelConnectionState({
    providerID: 'openrouter',
    credential: undefined,
    agent: null,
    toolsUnreachable: false,
    ...overrides
  })
}

const signedIn: AgentDetection = { state: 'signed-in', account: 'Claude Max' }

describe('model connection state', () => {
  test('reads a key or sign-in provider from its saved credential', () => {
    expect(state({ credential: 'configured' })).toBe('connected')
    expect(state({ credential: 'missing' })).toBe('needs-credential')
    expect(state({ credential: 'locked' })).toBe('unavailable')
    expect(state({ credential: undefined })).toBe('checking')
    expect(state({ providerID: 'chatgpt', credential: 'configured' })).toBe('connected')
  })

  test('reads a coding agent from what setup found', () => {
    const codex = { providerID: 'acp:codex' }
    expect(state({ ...codex, agent: { state: 'checking' } })).toBe('checking')
    expect(state({ ...codex, agent: { state: 'not-found' } })).toBe('not-installed')
    expect(state({ ...codex, agent: { state: 'found' } })).toBe('installed')
    expect(state({ ...codex, agent: { state: 'signed-out' } })).toBe('signed-out')
    expect(state({ ...codex, agent: signedIn })).toBe('connected')
    expect(state({ ...codex, agent: signedIn, toolsUnreachable: true })).toBe('tools-unreachable')
  })

  test("reads Cloud's AI service from the Home server, not a saved key", () => {
    const cloud = { providerID: OPENPENCIL_AI_PROVIDER }
    expect(state({ ...cloud, cloudAI: true })).toBe('connected')
    expect(state({ ...cloud, cloudAI: false, credential: 'configured' })).toBe('unavailable')
  })

  test('shows an agent as an agent where setup cannot check it', () => {
    expect(state({ providerID: 'acp:claude-code' })).toBe('agent')
    expect(state({ providerID: 'acp:claude-code', credential: 'configured' })).toBe('agent')
  })

  test('connects Pi through an AI Gateway key or its own provider login', () => {
    const pi = { providerID: 'harness:pi' }
    expect(state({ ...pi, credential: 'configured' })).toBe('connected')
    expect(state({ ...pi, agent: { state: 'found' } })).toBe('signed-out')
    expect(state({ ...pi, agent: { state: 'signed-in', account: null } })).toBe('connected')
    expect(state({ ...pi, agent: { state: 'not-found' } })).toBe('not-installed')
  })
})
