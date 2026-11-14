import type { SubagentState, SubagentTranscript } from '@/app/ai/chat/subagents'

/** The message key that names a subagent's state. */
export function subagentStateLabel(
  state: SubagentState | undefined
): 'subagentWorking' | 'subagentWaiting' | 'subagentDone' | 'subagentEnded' {
  if (state === 'requires_action') return 'subagentWaiting'
  if (state === 'idle') return 'subagentDone'
  if (state === 'unknown') return 'subagentEnded'
  return 'subagentWorking'
}

/**
 * How a subagent is named: by its cursor's callsign once it has one, with the title its parent
 * gave it beside; else by that title or what it was asked to do.
 */
export function subagentNames(
  transcript: SubagentTranscript,
  fallback: string
): { name: string; title?: string } {
  if (transcript.agent) {
    return { name: transcript.agent.name, title: transcript.title ?? transcript.description }
  }
  return { name: transcript.title ?? transcript.description ?? fallback }
}
