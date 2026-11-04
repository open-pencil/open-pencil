import { expect, test } from 'bun:test'

import {
  isSignedIn,
  parseAuthStatusUpdate,
  type AgentAuthStatus
} from '@/app/ai/agents/acp/auth/status'

test('reads the login from an auth status update and nothing else', () => {
  const status: AgentAuthStatus = {
    kind: 'account',
    label: 'Claude Max',
    account: { email: 'a@example.com' }
  }
  expect(parseAuthStatusUpdate('_auth/status_update', { authStatus: status })).toEqual(status)
  expect(parseAuthStatusUpdate('_other/update', { authStatus: status })).toBeNull()
  expect(parseAuthStatusUpdate('_auth/status_update', { authStatus: { kind: 'robot' } })).toBeNull()
})

test('treats every known identity but none as signed in', () => {
  expect(isSignedIn({ kind: 'none', label: 'Not logged in' })).toBe(false)
  expect(isSignedIn({ kind: 'api_key', label: 'Anthropic API key' })).toBe(true)
  expect(isSignedIn({ kind: 'external', label: 'AWS Bedrock' })).toBe(true)
})
