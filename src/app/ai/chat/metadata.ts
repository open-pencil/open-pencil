import type { UIMessage } from 'ai'
import * as v from 'valibot'
import { toRaw } from 'vue'

/**
 * What the chat keeps about a reply in its message metadata, which conversations store, so
 * the transcript shows the same after reopening: whether the user stopped it, and its edits
 * with those undone and what the model was last told about them.
 */

const metadataRecordSchema = v.record(v.string(), v.unknown())

/** A message's metadata as a record; the AI SDK leaves its type open. */
export function messageMetadata(message: UIMessage): Record<string, unknown> {
  return v.is(metadataRecordSchema, message.metadata) ? message.metadata : {}
}

/**
 * The message with `patch` merged into its metadata. It is built from the plain message: the
 * chat's messages are reactive, and a copy carrying Vue proxies cannot be saved.
 */
export function withMetadata(message: UIMessage, patch: Record<string, unknown>): UIMessage {
  const raw = toRaw(message)
  return { ...raw, metadata: { ...messageMetadata(raw), ...structuredClone(patch) } }
}

/** Replaces one of a chat's messages, by its ID. */
export function updateMessage(
  chat: { messages: UIMessage[] },
  messageId: string,
  change: (message: UIMessage) => UIMessage
): void {
  chat.messages = chat.messages.map((message) =>
    message.id === messageId ? change(message) : message
  )
}

const stoppedMetadataSchema = v.object({ stopped: v.literal(true) })

/** Whether the user stopped the reply before it finished. */
export function wasStopped(message: UIMessage): boolean {
  return v.is(stoppedMetadataSchema, message.metadata)
}

/** A reply's edits, those undone, and what the model was last told and which message told it. */
const replyUndoSchema = v.object({
  edits: v.array(v.object({ tool: v.string(), toolCallId: v.string() })),
  undone: v.array(v.string()),
  reported: v.optional(v.object({ undone: v.array(v.string()), in: v.string() }))
})

export type ReplyUndo = v.InferOutput<typeof replyUndoSchema>

export function undoOf(message: UIMessage): ReplyUndo | null {
  const parsed = v.safeParse(replyUndoSchema, messageMetadata(message).undo)
  return parsed.success ? parsed.output : null
}

export function withUndo(message: UIMessage, undo: ReplyUndo): UIMessage {
  return withMetadata(message, { undo })
}
