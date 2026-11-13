import { expect, test } from 'bun:test'

import {
  isSignedIn,
  parseAuthStatusUpdate,
  type AgentAuthStatus
} from '@/app/ai/agents/acp/auth/status'

test('reads the login an auth status update carries, and none it cannot describe', () => {
  const status: AgentAuthStatus = {
    kind: 'account',
    label: 'Claude Max',
    account: { email: 'a@example.com' }
  }
  expect(parseAuthStatusUpdate({ authStatus: status })).toEqual(status)
  expect(parseAuthStatusUpdate({ authStatus: { kind: 'robot' } })).toBeNull()
})

test('treats every known identity but none as signed in', () => {
  expect(isSignedIn({ kind: 'none', label: 'Not logged in' })).toBe(false)
  expect(isSignedIn({ kind: 'api_key', label: 'Anthropic API key' })).toBe(true)
  expect(isSignedIn({ kind: 'external', label: 'AWS Bedrock' })).toBe(true)
})
