import { isReasoningUIPart, isTextUIPart, isToolUIPart, type UIMessage } from 'ai'
import { toRaw } from 'vue'

import { wasStopped, withMetadata } from '@/app/ai/chat/metadata'
import { SUBAGENT_PART, subagentTranscript, type SubagentTranscript } from '@/app/ai/chat/subagents'

export interface SettleOptions {
  /** Whether the user stopped the reply, rather than it failing or being cut off. */
  stopped: boolean
  /** Whether a call changed the document; unknown for a conversation reopened later. */
  changed?: (toolCallId: string) => boolean
}

function unfinishedCallError(toolCallId: string, changed: SettleOptions['changed']): string {
  if (!changed) return 'The reply ended before this call reported back.'
  return changed(toolCallId)
    ? 'The reply ended while this call ran. It changed the document, but its result never arrived.'
    : 'The reply ended before this call finished. It did not change the document.'
}

function settleParts(
  parts: readonly UIMessage['parts'][number][],
  changed: SettleOptions['changed']
): UIMessage['parts'] {
  return parts.map((part): UIMessage['parts'][number] => {
    if ((isReasoningUIPart(part) || isTextUIPart(part)) && part.state === 'streaming') {
      return { ...part, state: 'done' }
    }
    if (
      isToolUIPart(part) &&
      (part.state === 'input-streaming' || part.state === 'input-available')
    ) {
      return {
        ...part,
        state: 'output-error',
        input: part.input,
        errorText: unfinishedCallError(part.toolCallId, changed)
      }
    }
    // A subagent still at work when the reply ended stopped with it, and so did its calls.
    const subagent = subagentTranscript(part)
    // One the agent never reported done, as on ACP's older subagent draft, has no state at all.
    if (subagent && subagent.state !== 'idle' && subagent.state !== 'unknown') {
      const settled: SubagentTranscript = {
        ...subagent,
        state: 'unknown',
        parts: settleParts(subagent.parts, changed)
      }
      return { ...part, type: SUBAGENT_PART, data: settled }
    }
    return part
  })
}

/**
 * A reply as it stands once it ended without finishing, stopped or failed: nothing in it still
 * reads as running. Reasoning and text are done, a call that never reported back fails with
 * what happened to the document, which the model reads on the next request, and a subagent at
 * work stops with its calls.
 */
export function settleMessage(live: UIMessage, { stopped, changed }: SettleOptions): UIMessage {
  // The chat's messages are reactive; the settled one is built from plain values, so the
  // conversation can still be saved with `structuredClone`.
  const message = toRaw(live)
  const parts = settleParts(message.parts, changed)
  const unchanged = parts.every((part, index) => part === message.parts[index])
  if (unchanged && (!stopped || wasStopped(message))) return live
  const settled = { ...message, parts }
  return stopped ? withMetadata(settled, { stopped: true }) : settled
}
