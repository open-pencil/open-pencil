import type { SubagentState } from '@/app/ai/chat/subagents'

/** The message key that names a subagent's state. */
export function subagentStateLabel(
  state: SubagentState | undefined
): 'subagentWorking' | 'subagentWaiting' | 'subagentDone' | 'subagentEnded' {
  if (state === 'requires_action') return 'subagentWaiting'
  if (state === 'idle') return 'subagentDone'
  if (state === 'unknown') return 'subagentEnded'
  return 'subagentWorking'
}
