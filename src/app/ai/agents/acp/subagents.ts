import type { SessionNotification } from '@agentclientprotocol/sdk/unstable'

import { noteToolCall, subagentFinished } from '@/app/automation/agents'

/** Work states after which a subagent is done until its parent gives it more work. */
const FINISHED_STATES: ReadonlySet<string> = new Set(['idle', 'unknown'])

/**
 * Tells OpenPencil which subagent made each tool call of the app chat `chat`, whose agent works
 * in the ACP session `root`. The transport advertises ACP's subagent sessions, so an agent that
 * runs subagents reports each one's work under its own session id, nested ones included, and
 * says on the parent session when one is done. The agent's MCP calls carry only a call id, which
 * these updates connect to a subagent (`withSubagent` in `src/app/automation/agents.ts`).
 */
export function noteSubagents(
  chat: string,
  root: string,
  { sessionId, update }: SessionNotification
): void {
  if (update.sessionUpdate === 'subagent_update') {
    if (update.state && FINISHED_STATES.has(update.state.state)) {
      subagentFinished(chat, update.sessionId)
    }
    return
  }
  if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') return
  noteToolCall(chat, {
    id: update.toolCallId,
    subagent: sessionId === root ? undefined : sessionId,
    ended: update.status === 'completed' || update.status === 'failed'
  })
}
