import type { EditorViewState } from '#core/editor/types'

import type { CanvasView, EditorProfile } from './types'

export const EDIT_VIEW: CanvasView = { id: 'edit' }

const EDIT_PROFILE: EditorProfile = {
  pointer: 'tools',
  shortcuts: 'all',
  editChrome: true,
  live: null,
  panels: true,
  leaveTo: null
}

/** A preview runs the design: the canvas only pans, and its controls take the pointer. */
function playProfile(revision: number): EditorProfile {
  return {
    pointer: 'pan',
    shortcuts: 'view',
    editChrome: false,
    live: { revision },
    panels: false,
    leaveTo: EDIT_VIEW
  }
}

/**
 * The profile a canvas behaves by. Pass the pane's own state, since each pane shows its own view.
 */
export function resolveEditorProfile(state: Pick<EditorViewState, 'canvasView'>): EditorProfile {
  const view = state.canvasView
  return view.id === 'play' ? playProfile(view.revision) : EDIT_PROFILE
}
