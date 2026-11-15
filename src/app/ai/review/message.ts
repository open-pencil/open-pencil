import { generateId, type UIMessage } from 'ai'
import * as v from 'valibot'

import { messageMetadata } from '@/app/ai/chat/metadata'

/**
 * A design review the Review model wrote: its findings as Markdown, with links to the layers
 * they are about, the layers it reviewed, what the person asked it to focus on, and for a review
 * of one AI edit, the tool call that made it.
 */
const reviewSchema = v.object({
  findings: v.string(),
  nodeIds: v.array(v.string()),
  focus: v.optional(v.string()),
  change: v.optional(v.string())
})

export type DesignReview = v.InferOutput<typeof reviewSchema>

export function reviewOf(message: UIMessage): DesignReview | null {
  const parsed = v.safeParse(reviewSchema, messageMetadata(message).review)
  return parsed.success ? parsed.output : null
}

/**
 * The message a review adds to the conversation. The transcript draws it as a review; no model
 * reads it, so the Design model sees its findings only when the person sends them on.
 */
export function reviewMessage(review: DesignReview, id = generateId()): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text: review.findings }],
    metadata: { review }
  }
}
