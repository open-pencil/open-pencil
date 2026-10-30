import type { Tool } from '#core/editor/types'

/**
 * What the host takes away from every view, whatever the canvas shows: a read-only document, as
 * for a viewer or an earlier version, can be looked at, selected in, and copied from, not changed.
 */
export interface EditorRestrictions {
  readOnly: boolean
}

/**
 * What a canvas pane shows: the design being edited, or the design running as a preview whose
 * controls respond to the pointer. Each pane has its own.
 */
export type CanvasView = { id: 'edit' } | { id: 'play'; revision: number }

/**
 * How the editor behaves for a canvas, resolved from its view. Front ends read these values
 * rather than asking which view is showing, so a new view is a new profile, not a new branch at
 * every place that behaves differently.
 */
export interface EditorProfile {
  /** What the pointer does on the canvas: every tool, or only panning and zooming. */
  pointer: 'tools' | 'pan'
  /** Which shortcuts run: every one, or only those that switch or leave the view. */
  shortcuts: 'all' | 'view'
  /** Whether the canvas draws what editing needs: selection, hover, pixel grid, and rulers. */
  editChrome: boolean
  /**
   * The run of layers that hold controls as live components, and of animated shaders; a new
   * revision starts them afresh. Null while layers draw as designed.
   */
  live: { revision: number } | null
  /** Whether the editor's panels stay beside a canvas shown on its own. */
  panels: boolean
  /** The view leaving this one returns to, as Escape does, or null when there is none. */
  leaveTo: CanvasView | null
  /**
   * Whether the document can change: actions that edit it, undo, and the canvas's edit handles,
   * text editing, value scrubbing, guide editing, and layer drags.
   */
  edits: boolean
  /** The tools on offer, or null for every tool. */
  tools: ReadonlySet<Tool> | null
}
