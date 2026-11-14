import * as v from 'valibot'

import type { ChatMessagePart } from '@/app/ai/chat/tool-calls/display'

/**
 * The part a coding agent's reply keeps for each subagent it ran, under the subagent's ACP session
 * id, so the chat can show where it started and open what it did.
 */
export const SUBAGENT_PART = 'data-subagent'

export const SUBAGENT_STATES = ['running', 'idle', 'requires_action', 'unknown'] as const
export type SubagentState = (typeof SUBAGENT_STATES)[number]

/** What a subagent was asked to do and what it did, as its own reply would show it. */
export interface SubagentTranscript {
  /** The subagent's ACP session. */
  session: string
  /** The name its parent gave it, such as "Left card builder". */
  title?: string
  /** What its parent asked of it. */
  description?: string
  state?: SubagentState
  /**
   * The agent it shows as on the canvas, once it touched a document: its callsign and color, kept
   * so a reopened conversation names it as it was, and its presence id while it works.
   */
  agent?: { id: string; name: string; color: string }
  parts: ChatMessagePart[]
}

/** A stored part keeps the shape the chat gave it; only its kind is read here. */
function isMessagePart(value: unknown): value is ChatMessagePart {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  )
}

const transcriptSchema = v.object({
  session: v.string(),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  state: v.optional(v.picklist(SUBAGENT_STATES)),
  agent: v.optional(
    v.object({ id: v.string(), name: v.string(), color: v.pipe(v.string(), v.hexColor()) })
  ),
  parts: v.array(v.custom<ChatMessagePart>(isMessagePart))
})

/** The subagent a reply's part holds, or null for any other part. */
export function subagentTranscript(part: ChatMessagePart): SubagentTranscript | null {
  if (part.type !== SUBAGENT_PART || !('data' in part)) return null
  const parsed = v.safeParse(transcriptSchema, part.data)
  return parsed.success ? parsed.output : null
}

/** An ACP state as the chat keeps it; a state the chat does not know reads as unknown. */
export function subagentState(state: string): SubagentState {
  return v.is(v.picklist(SUBAGENT_STATES), state) ? state : 'unknown'
}
