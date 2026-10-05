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

/** How one kind of control answers the pointer in preview. */
export interface PlayInteraction {
  /** Handle a press; return true to keep receiving `drag` until release. */
  press(pointer: PlayPointer): boolean
  drag?(pointer: Omit<PlayPointer, 'hitId'>): void
}
