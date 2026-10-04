import { shallowReactive, shallowRef } from 'vue'

import type { ToolChange } from './types'

const changes = shallowReactive(new Map<string, ToolChange>())
/** Bumped whenever a change is recorded or its images arrive, so the history saves it. */
export const toolChangesVersion = shallowRef(0)

/** Reactive in a computed or template: the map tracks reads by key. */
export function readToolChange(toolCallId: string): ToolChange | null {
  return changes.get(toolCallId) ?? null
}

export function setToolChange(change: ToolChange): void {
  changes.set(change.toolCallId, change)
  toolChangesVersion.value++
}

export function clearToolChanges(): void {
  changes.clear()
}
