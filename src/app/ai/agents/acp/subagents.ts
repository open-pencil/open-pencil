import type { SessionUpdate } from '@agentclientprotocol/sdk'
import * as v from 'valibot'

import { noteToolCall } from '@/app/automation/agents'

/**
 * Claude Code's adapter stamps every report of a call made inside a subagent with the id of the
 * Agent (Task) call that started that subagent.
 */
const claudeSubagentSchema = v.object({
  claudeCode: v.object({ parentToolUseId: v.string() })
})

/**
 * Tells OpenPencil which subagent each tool call of the app chat `chat` belongs to, as its agent's
 * ACP updates say. The agent's MCP calls carry only a call id, which these updates connect to a
 * subagent (`withSubagent` in `src/app/automation/agents.ts`).
 */
export function noteSubagents(chat: string, update: SessionUpdate): void {
  if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') return
  const meta = v.safeParse(claudeSubagentSchema, update._meta)
  noteToolCall(chat, {
    id: update.toolCallId,
    subagent: meta.success ? meta.output.claudeCode.parentToolUseId : undefined,
    ended: update.status === 'completed' || update.status === 'failed'
  })
}
