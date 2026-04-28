import type { useSelectionCapabilities } from '#vue/editor/selection-capabilities/use'
import type { useSelectionState } from '#vue/editor/selection-state/use'
import type { Editor } from '@open-pencil/core/editor'
import type { ComputedRef } from 'vue'

export type CommandMessagesStore = { value: Record<string, string> }
export type SelectionState = ReturnType<typeof useSelectionState>
export type SelectionCapabilities = ReturnType<typeof useSelectionCapabilities>

export type EditorCommandMapOptions = {
  editor: Editor
  selection: SelectionState
  capabilities: SelectionCapabilities
  messages: CommandMessagesStore
  otherPages: ComputedRef<Array<{ id: string }>>
  moveSelectionToPage: (pageId: string) => void
}
