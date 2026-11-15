import type { InjectionKey, Ref } from 'vue'

/**
 * Whether node IDs in the transcript refer to the open document. A conversation from another
 * document shows its tool calls, but their layers are not this document's.
 */
export const CHAT_NODES_LIVE: InjectionKey<Readonly<Ref<boolean>>> = Symbol('chat-nodes-live')

/** Asking the Review model whether one AI edit improved the design, from its change preview. */
export interface ChatChangeReview {
  review: (toolCallId: string) => void
  /** Whether a review can start now: the chat is idle and no review is running. */
  ready: Readonly<Ref<boolean>>
}

/** Provided where a transcript can review changes; its change previews offer it then. */
export const CHAT_CHANGE_REVIEW: InjectionKey<ChatChangeReview> = Symbol('chat-change-review')
