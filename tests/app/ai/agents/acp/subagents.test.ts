import { afterEach, describe, expect, test } from 'bun:test'

import type { SessionNotification, SessionUpdate } from '@agentclientprotocol/sdk/unstable'

import { OPEN_PENCIL_MCP_SERVER } from '@open-pencil/core/constants'

import { noteSubagents } from '@/app/ai/agents/acp/subagents'
import { restAgents, withSubagent } from '@/app/automation/agents'

const CHAT = '0123456789abcdef'
const ROOT = 'session-root'
const TOOL = `mcp__${OPEN_PENCIL_MCP_SERVER}__create_shape`

afterEach(() => restAgents('acp'))

/** The chat's agent reported `update` in its session `sessionId`. */
function report(update: SessionUpdate, sessionId = ROOT): void {
  const notification: SessionNotification = { sessionId, update }
  noteSubagents(CHAT, ROOT, notification)
}

function call(id: string, status: 'pending' | 'completed' = 'pending'): SessionUpdate {
  return { sessionUpdate: 'tool_call_update', toolCallId: id, title: TOOL, status }
}

/** The subagent a tool call of the chat's agent belongs to, as OpenPencil's MCP server sees it. */
function subagentOf(id: string, chat = CHAT): string | undefined {
  return withSubagent({ session: 'session-1', kind: 'acp', chat, call: id }).subagent
}

describe('which subagent a coding agent’s tool call belongs to', () => {
  test('is the session the agent reported it in, for that chat only', () => {
    report(call('call-inner'), 'subagent-1')
    expect(subagentOf('call-inner')).toBe('subagent-1')
    expect(subagentOf('call-inner', 'fedcba9876543210')).toBeUndefined()
  })

  test('is a nested subagent’s own session', () => {
    report({ sessionUpdate: 'subagent_update', sessionId: 'subagent-2' }, 'subagent-1')
    report(call('call-nested'), 'subagent-2')
    expect(subagentOf('call-nested')).toBe('subagent-2')
  })

  test('is none for a call the agent made in its own session', () => {
    report(call('call-own'))
    expect(subagentOf('call-own')).toBeUndefined()
  })

  test('ends with the call: a finished call is forgotten', () => {
    report(call('call-inner'), 'subagent-1')
    report(call('call-inner', 'completed'), 'subagent-1')
    expect(subagentOf('call-inner')).toBeUndefined()
  })

  test('ends when the agent says the subagent is done, and not while it works', () => {
    report(call('call-inner'), 'subagent-1')
    const state = (s: 'running' | 'idle' | 'unknown'): SessionUpdate => ({
      sessionUpdate: 'subagent_update',
      sessionId: 'subagent-1',
      state: { state: s }
    })
    report(state('running'))
    expect(subagentOf('call-inner')).toBe('subagent-1')
    report(state('idle'))
    expect(subagentOf('call-inner')).toBeUndefined()

    report(call('call-later'), 'subagent-1')
    report(state('unknown'))
    expect(subagentOf('call-later')).toBeUndefined()
  })
})
