import { computed, shallowRef } from 'vue'

import { revokeImagePreviewURL } from '@/app/ai/attachment/image/prepare'
import type { ChatSubmission } from '@/app/ai/chat/submission/types'

/**
 * How a message written while the agent works reaches it, as in pi: `steer` goes in as soon as
 * the current tool calls finish, and `follow-up` waits until the agent has finished all work.
 * An agent that cannot take a message mid-turn gets either once its turn ends.
 */
export type QueuedMessageKind = 'steer' | 'follow-up'

export interface QueuedMessage {
  id: string
  kind: QueuedMessageKind
  submission: ChatSubmission
}

const items = shallowRef<readonly QueuedMessage[]>([])

/** Messages the person wrote while the agent was working, in the order they wrote them. */
export const queuedMessages = computed(() => items.value)

/** Whether a message is waiting to go in mid-turn; the built-in chat ends its run for it. */
export function hasSteeringMessage(): boolean {
  return items.value.some((item) => item.kind === 'steer')
}

export function enqueueMessage(submission: ChatSubmission, kind: QueuedMessageKind): void {
  items.value = [...items.value, { id: crypto.randomUUID(), kind, submission }]
}

/** The next message to send: steering first, then follow-ups, each in the order written. */
export function takeNextMessage(): ChatSubmission | null {
  const next = items.value.find((item) => item.kind === 'steer') ?? items.value.at(0)
  if (!next) return null
  items.value = items.value.filter((item) => item !== next)
  return next.submission
}

/** Takes every queued message back, oldest first, so the person can edit them. */
export function takeBackMessages(): ChatSubmission[] {
  const taken = items.value.map((item) => item.submission)
  items.value = []
  return taken
}

export function removeQueuedMessage(id: string): void {
  const removed = items.value.find((item) => item.id === id)
  if (!removed) return
  items.value = items.value.filter((item) => item !== removed)
  for (const image of removed.submission.images) revokeImagePreviewURL(image.previewURL)
}

/** Drops the queue, as when the conversation changes underneath it. */
export function clearQueuedMessages(): void {
  for (const item of items.value) removeQueuedMessage(item.id)
}
