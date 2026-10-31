import type { DocumentKind } from '@open-pencil/scene-graph'

import { BOARD_GRID } from '#core/constants'
import { BOARD_TOOL_SHORTCUTS, BOARD_TOOLS, TOOL_SHORTCUTS } from '#core/editor/tool-registry'
import type { Tool } from '#core/editor/types'

import type { CanvasView, EditorProfile, EditorProfileInputs, EditorRestrictions } from './types'

export const EDIT_VIEW: CanvasView = { id: 'edit' }

/** The tools a read-only document keeps, as Figma's toolbar shows while a version is viewed. */
export const READ_ONLY_TOOLS: ReadonlySet<Tool> = new Set<Tool>(['SELECT', 'HAND'])

/** What the document's kind decides: its tools and keys, its grids, and how deep a click goes. */
type DocumentBehaviour = Pick<
  EditorProfile,
  'edits' | 'tools' | 'toolKeys' | 'snapGrid' | 'dotGrid' | 'pixelGrid' | 'framesOpen' | 'lint'
>

/** What the canvas's view decides: how the pointer, keys, chrome, and panels behave. */
type ViewBehaviour = Omit<EditorProfile, keyof DocumentBehaviour>

const DOCUMENT_BEHAVIOURS: Readonly<Record<DocumentKind, DocumentBehaviour>> = {
  design: {
    edits: true,
    tools: null,
    toolKeys: TOOL_SHORTCUTS,
    snapGrid: 1,
    dotGrid: null,
    pixelGrid: true,
    framesOpen: true,
    lint: true
  },
  board: {
    edits: true,
    tools: BOARD_TOOLS,
    toolKeys: BOARD_TOOL_SHORTCUTS,
    snapGrid: BOARD_GRID,
    dotGrid: BOARD_GRID,
    pixelGrid: false,
    framesOpen: false,
    lint: false
  }
}

const EDIT_BEHAVIOUR: ViewBehaviour = {
  pointer: 'tools',
  shortcuts: 'all',
  editChrome: true,
  live: null,
  panels: true,
  leaveTo: null
}

/** A preview runs the design: the canvas only pans, and its controls take the pointer. */
function playBehaviour(revision: number): ViewBehaviour {
  return {
    pointer: 'pan',
    shortcuts: 'view',
    editChrome: false,
    live: { revision },
    panels: false,
    leaveTo: EDIT_VIEW
  }
}

function viewBehaviour(view: CanvasView): ViewBehaviour {
  return view.id === 'play' ? playBehaviour(view.revision) : EDIT_BEHAVIOUR
}

/** Narrows a profile by the host's restrictions; a restriction only ever takes away. */
function restrict(profile: EditorProfile, restrictions: EditorRestrictions): EditorProfile {
  if (!restrictions.readOnly) return profile
  const tools = profile.tools
    ? new Set([...profile.tools].filter((tool) => READ_ONLY_TOOLS.has(tool)))
    : READ_ONLY_TOOLS
  return { ...profile, edits: false, tools }
}

/**
 * The profile a canvas behaves by: what its document is for, then the view it shows, narrowed by
 * the host's restrictions. Pass the pane's own state, since each pane shows its own view.
 */
export function resolveEditorProfile(state: EditorProfileInputs): EditorProfile {
  const profile = { ...DOCUMENT_BEHAVIOURS[state.documentKind], ...viewBehaviour(state.canvasView) }
  return restrict(profile, state.hostRestrictions)
}

/**
 * The tool, if the profile offers it, or Move: a tool the profile stops offering, as when a
 * document opens as a board, turns into one, or goes read-only, gives way to Move.
 */
export function offeredTool(state: EditorProfileInputs, tool: Tool): Tool {
  const { tools } = resolveEditorProfile(state)
  return !tools || tools.has(tool) ? tool : 'SELECT'
}
