import { getToolName } from 'ai'

import type { ToolCallPart } from '@/app/ai/chat/tool-calls/display'

export type ToolDisplayState = 'pending' | 'done' | 'error'

export type ToolStateInput = {
  toolName: string
  state: string
  output?: unknown
}

export function isMCPToolName(toolName: string): boolean {
  return toolName.startsWith('mcp__')
}

function hasErrorOutput(output: unknown): boolean {
  return typeof output === 'object' && output !== null && 'error' in output
}

export function classifyToolState({ toolName, state, output }: ToolStateInput): ToolDisplayState {
  if (state === 'output-error' || (state === 'output-available' && hasErrorOutput(output))) {
    return 'error'
  }

  if (
    isMCPToolName(toolName) &&
    state === 'output-available' &&
    typeof output === 'object' &&
    output !== null &&
    'content' in output &&
    Array.isArray(output.content)
  ) {
    return 'isError' in output && output.isError === true ? 'error' : 'done'
  }

  if (state === 'output-available') return 'done'
  return 'pending'
}

/** A chat tool call's display state. */
export function toolCallState(part: ToolCallPart): ToolDisplayState {
  return classifyToolState({ toolName: getToolName(part), state: part.state, output: part.output })
}
