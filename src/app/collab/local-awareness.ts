import { watch } from 'vue'
import type { Awareness } from 'y-protocols/awareness'

import type { Color } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { presenceOf, setOwnerColor } from '@/app/presence/registry'

/** Publish our agents to the room while connected; they take our collaborator color. */
export function publishLocalAgents(
  store: EditorStore,
  getAwareness: () => Awareness | null,
  color: Color
): () => void {
  setOwnerColor(store, color)
  const stop = watch(
    presenceOf(store).agents,
    (agents) => getAwareness()?.setLocalStateField('agents', agents),
    { immediate: true }
  )
  return () => {
    stop()
    setOwnerColor(store, null)
  }
}
