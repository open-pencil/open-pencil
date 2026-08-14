import type { EditorState } from '#core/editor/types'

import { createDefaultEditorSharedState } from './shared'
import { createDefaultEditorViewState } from './view'

export function createDefaultEditorState(pageId: string): EditorState {
  return {
    ...createDefaultEditorSharedState(),
    ...createDefaultEditorViewState(pageId)
  }
}
