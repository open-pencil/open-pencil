import type { SceneGraph } from '@open-pencil/scene-graph'

import type { PlaySession, PlayTarget } from '#core/editor/play/session'

/** A press or drag on a control in preview, at a canvas point. */
export interface PlayPointer {
  /** The document graph, for where the instance's parts sit on the canvas. */
  graph: SceneGraph
  session: PlaySession
  target: PlayTarget
  /** The deepest node under the pointer. */
  hitId: string
  x: number
  y: number
}

/** The control preview is acting on, without a pointer: for keys and restoring. */
export type PlayControl = Pick<PlayPointer, 'graph' | 'session' | 'target'>

/** A key pressed while a control has keyboard focus, as `KeyboardEvent.key` names it. */
export interface PlayKey extends PlayControl {
  key: string
  shift: boolean
}

/** How one kind of control answers the pointer and keyboard in preview. */
export interface PlayInteraction {
  /** Handle a press; return true to keep receiving `drag` until release. */
  press?(pointer: PlayPointer): boolean
  drag?(pointer: Omit<PlayPointer, 'hitId'>): void
  /** Handle a key; return whether the control used it. */
  key?(key: PlayKey): boolean
  /** Whether a press shows focus too, as a text field shows it while it takes typing. */
  focusOnPress?: boolean
  /** Draw values set in preview again after a variant switch rebuilt the copy. */
  restore?(control: PlayControl): void
}
