import { afterEach, describe, expect, test } from 'bun:test'

import type { SessionUpdate } from '@agentclientprotocol/sdk/unstable'

import { OPEN_PENCIL_MCP_SERVER } from '@open-pencil/core/constants'

import { noteSubagents } from '@/app/ai/agents/acp/subagents'
import { restAgents, withSubagent } from '@/app/automation/agents'

const CHAT = '0123456789abcdef'
const TOOL = `mcp__${OPEN_PENCIL_MCP_SERVER}__create_shape`

afterEach(() => restAgents('acp'))

/** Claude Code's adapter stamps a call made inside a subagent with that subagent's Agent call. */
function claudeCall(id: string, parent?: string): SessionUpdate {
  return {
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: TOOL,
    kind: 'other',
    status: 'pending',
    rawInput: {},
    _meta: { claudeCode: { toolName: TOOL, ...(parent ? { parentToolUseId: parent } : {}) } }
  }
}

function claudeEnded(id: string, parent: string): SessionUpdate {
  return {
    sessionUpdate: 'tool_call_update',
    toolCallId: id,
    status: 'completed',
    _meta: { claudeCode: { parentToolUseId: parent } }
  }
}

/** The subagent a tool call of the chat's agent belongs to, as OpenPencil's MCP server sees it. */
function subagentOf(call: string, chat = CHAT): string | undefined {
  return withSubagent({ session: 'session-1', kind: 'acp', chat, call }).subagent
}

describe('which subagent a coding agent’s tool call belongs to', () => {
  test('is the Agent call its report names, for that chat only', () => {
    noteSubagents(CHAT, claudeCall('toolu_inner', 'toolu_task'))
    expect(subagentOf('toolu_inner')).toBe('toolu_task')
    expect(subagentOf('toolu_inner', 'fedcba9876543210')).toBeUndefined()
  })

  test('is learned from a later report too, for a call first reported without it', () => {
    noteSubagents(CHAT, claudeCall('toolu_inner'))
    expect(subagentOf('toolu_inner')).toBeUndefined()
    noteSubagents(CHAT, {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'toolu_inner',
      status: 'in_progress',
      _meta: { claudeCode: { parentToolUseId: 'toolu_task' } }
    })
    expect(subagentOf('toolu_inner')).toBe('toolu_task')
  })

  test('is none for a call the agent itself made, or one another agent reports', () => {
    noteSubagents(CHAT, claudeCall('toolu_own'))
    noteSubagents(CHAT, {
      sessionUpdate: 'tool_call',
      toolCallId: 'call-1',
      title: `mcp.${OPEN_PENCIL_MCP_SERVER}.create_shape`,
      status: 'in_progress',
      rawInput: { server: OPEN_PENCIL_MCP_SERVER, tool: 'create_shape', arguments: {} }
    })
    expect(subagentOf('toolu_own')).toBeUndefined()
    expect(subagentOf('call-1')).toBeUndefined()
  })

  test('ends with the call: a finished call is forgotten', () => {
    noteSubagents(CHAT, claudeCall('toolu_inner', 'toolu_task'))
    noteSubagents(CHAT, claudeEnded('toolu_inner', 'toolu_task'))
    expect(subagentOf('toolu_inner')).toBeUndefined()
  })
})
