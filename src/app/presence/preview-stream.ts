import type { EditorStore } from '@/app/editor/active-store'

/**
 * What a local agent's streamed `render` call shows before it runs, as other people in the
 * room should see it. Unlike the rest of an agent's presence it carries content: the JSX the
 * agent is about to commit to the shared document, and nothing else from its tools or prompts.
 */
export type AgentPreviewEvent =
  | { type: 'start'; agentId: string; callId: string; pageId: string }
  | { type: 'delta'; agentId: string; callId: string; text: string }
  | { type: 'finish'; agentId: string; callId: string }
  /** The agent stopped previewing: its step ended, failed, or was stopped. */
  | { type: 'clear'; agentId: string }

type AgentPreviewListener = (event: AgentPreviewEvent) => void

const listeners = new WeakMap<EditorStore, Set<AgentPreviewListener>>()

/** Tell whoever shares this document, such as a room, what a local agent is previewing. */
export function publishAgentPreview(store: EditorStore, event: AgentPreviewEvent): void {
  for (const listener of listeners.get(store) ?? []) listener(event)
}

/** Follow this document's local agent previews; returns the unsubscribe. */
export function onAgentPreview(store: EditorStore, listener: AgentPreviewListener): () => void {
  const set = listeners.get(store) ?? new Set<AgentPreviewListener>()
  listeners.set(store, set)
  set.add(listener)
  return () => set.delete(listener)
}
