import type { UIMessageChunk } from 'ai'

/** A tool call as the chat shows it. */
export interface ReplyToolCall {
  id: string
  name: string
  /** The agent's own title, for its own tools; OpenPencil's are named by `name`. */
  title?: string
}

/**
 * Builds one reply's message chunks from what a coding agent reports. Consecutive text or
 * thought forms one part, which closes when anything else arrives, so text after a tool call
 * starts a new part and a run of thoughts shows as one.
 */
export function createReplyStream(idPrefix: string) {
  let parts = 0
  let text: string | null = null
  let reasoning: string | null = null

  function nextId(kind: string): string {
    parts += 1
    return `${idPrefix}-${kind}-${parts}`
  }

  function closeText(): UIMessageChunk[] {
    if (!text) return []
    const id = text
    text = null
    return [{ type: 'text-end', id }]
  }

  function closeReasoning(): UIMessageChunk[] {
    if (!reasoning) return []
    const id = reasoning
    reasoning = null
    return [{ type: 'reasoning-end', id }]
  }

  return {
    text(delta: string): UIMessageChunk[] {
      if (!delta) return []
      const chunks = closeReasoning()
      if (!text) {
        text = nextId('text')
        chunks.push({ type: 'text-start', id: text })
      }
      chunks.push({ type: 'text-delta', id: text, delta })
      return chunks
    },

    thought(delta: string): UIMessageChunk[] {
      if (!delta) return []
      const chunks = closeText()
      if (!reasoning) {
        reasoning = nextId('reasoning')
        chunks.push({ type: 'reasoning-start', id: reasoning })
      }
      chunks.push({ type: 'reasoning-delta', id: reasoning, delta })
      return chunks
    },

    /** A call begins; its input may follow. */
    toolStart({ id, name, title }: ReplyToolCall): UIMessageChunk[] {
      return [
        ...closeText(),
        ...closeReasoning(),
        { type: 'tool-input-start', toolCallId: id, toolName: name, providerExecuted: true, title }
      ]
    },

    /** A call's complete input, which may come with its start or after it. */
    toolInput({ id, name, title }: ReplyToolCall, input: unknown): UIMessageChunk[] {
      return [
        ...closeText(),
        ...closeReasoning(),
        {
          type: 'tool-input-available',
          toolCallId: id,
          toolName: name,
          input,
          providerExecuted: true,
          title
        }
      ]
    },

    toolResult(id: string, output: unknown): UIMessageChunk[] {
      return [{ type: 'tool-output-available', toolCallId: id, output, providerExecuted: true }]
    },

    toolError(id: string, errorText: string): UIMessageChunk[] {
      return [{ type: 'tool-output-error', toolCallId: id, errorText, providerExecuted: true }]
    },

    /** Closes the text or thought still open when the reply ends. */
    end(): UIMessageChunk[] {
      return [...closeText(), ...closeReasoning()]
    }
  }
}

export type ReplyStream = ReturnType<typeof createReplyStream>
