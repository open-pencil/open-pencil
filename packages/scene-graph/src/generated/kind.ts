import type { SceneGraph } from '../graph'
import type { SceneNode } from '../types'

/**
 * What the editor and file formats need to know about one type of generated frame, so they ask
 * the type rather than test for it. Each type defines one in its own module.
 */
export interface GeneratedFrameKind {
  /** Whether the frame still has its template's layers; one that lost them is a plain frame. */
  complete(graph: SceneGraph, frame: SceneNode): boolean
  /** The text a user types into in place: on double-click or Enter, and as a script's `text`. */
  text(graph: SceneGraph, frame: SceneNode): SceneNode | undefined
  /** Whether the frame turns; FigJam keeps sticky notes upright. */
  rotates: boolean
  /** Whether the frame's resize handles and W and H fields resize it freely. */
  resizes: boolean
  /** Whether it takes its name from its text until the user names it, as a sticky note does. */
  namedByText: boolean
  /**
   * What a width or height set on `frame` from outside layout also sets on it, such as the height
   * a shape with text was given, which layout grows it from.
   */
  sized?(changes: Partial<SceneNode>, frame: SceneNode): Partial<SceneNode>
}
