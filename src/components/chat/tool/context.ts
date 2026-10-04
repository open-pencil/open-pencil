import type { InjectionKey, Ref } from 'vue'

/**
 * Whether node IDs in the transcript refer to the open document. A conversation from another
 * document shows its tool calls, but their layers are not this document's.
 */
export const CHAT_NODES_LIVE: InjectionKey<Readonly<Ref<boolean>>> = Symbol('chat-nodes-live')
