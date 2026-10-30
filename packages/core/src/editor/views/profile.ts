import type { EditorState, Tool } from '#core/editor/types'

import type { CanvasView, EditorProfile, EditorRestrictions } from './types'

export const EDIT_VIEW: CanvasView = { id: 'edit' }

/** The tools a read-only document keeps, as Figma's toolbar shows while a version is viewed. */
export const READ_ONLY_TOOLS: ReadonlySet<Tool> = new Set<Tool>(['SELECT', 'HAND'])

const EDIT_PROFILE: EditorProfile = {
  pointer: 'tools',
  shortcuts: 'all',
  editChrome: true,
  live: null,
  panels: true,
  leaveTo: null,
  edits: true,
  tools: null
}

/** A preview runs the design: the canvas only pans, and its controls take the pointer. */
function playProfile(revision: number): EditorProfile {
  return {
    pointer: 'pan',
    shortcuts: 'view',
    editChrome: false,
    live: { revision },
    panels: false,
    leaveTo: EDIT_VIEW,
    edits: true,
    tools: null
  }
}

function viewProfile(view: CanvasView): EditorProfile {
  return view.id === 'play' ? playProfile(view.revision) : EDIT_PROFILE
}

/** Narrows a view's profile by the host's restrictions; a restriction only ever takes away. */
function restrict(profile: EditorProfile, restrictions: EditorRestrictions): EditorProfile {
  if (!restrictions.readOnly) return profile
  const tools = profile.tools
    ? new Set([...profile.tools].filter((tool) => READ_ONLY_TOOLS.has(tool)))
    : READ_ONLY_TOOLS
  return { ...profile, edits: false, tools }
}

/**
 * The profile a canvas behaves by: its view's, narrowed by the host's restrictions. Pass the
 * pane's own state, since each pane shows its own view.
 */
export function resolveEditorProfile(
  state: Pick<EditorState, 'canvasView' | 'hostRestrictions'>
): EditorProfile {
  return restrict(viewProfile(state.canvasView), state.hostRestrictions)
}
