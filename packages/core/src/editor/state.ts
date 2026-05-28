import type { EditorState } from '#core/editor/types'

import { createDefaultEditorSharedState } from './shared-state'
import { createDefaultEditorViewState } from './view-state'

export function createDefaultEditorState(pageId: string): EditorState {
  return {
    ...createDefaultEditorSharedState(),
    ...createDefaultEditorViewState(pageId)
  }
}
