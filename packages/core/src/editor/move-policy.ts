import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import type { UndoManager } from '@open-pencil/scene-graph/undo'

/** A move the person is about to make: a layer's new position, live while they drag, or as it lands. */
export interface MoveChange {
  node: SceneNode
  /** Where the layer would go, in its parent's coordinates; a nudge or an edit may give one axis. */
  to: Partial<Vector>
  /** A drag's live preview, written again on the next pointer move, rather than a move landing. */
  preview: boolean
}

/**
 * Decides a move the person makes: returns where the layer goes, adjusted as the host likes (kept
 * on a line, clamped to an area, snapped to a slot), or null to keep it where it is. It runs on
 * every pointer move of a drag, so it stays cheap.
 */
export type MovePolicy = (change: MoveChange) => Partial<Vector> | null

/**
 * The host's move policy (`setMovePolicy`) and the scope of the host's own edits (`asHost`),
 * which neither the policy nor the host's restrictions narrow. Undo and redo replay what was
 * decided already, so they pass too.
 */
export function createMovePolicy(undo: Pick<UndoManager, 'isReplaying'>) {
  let policy: MovePolicy | null = null
  let hostDepth = 0

  /** Sets how the person's moves are decided; null lets them all through. */
  function setMovePolicy(next: MovePolicy | null) {
    policy = next
  }

  /** Whether the host's own edit is running (`asHost`). */
  const isHostEdit = () => hostDepth > 0

  /** Runs `run` as the host's own edit. */
  function runAsHost<T>(run: () => T): T {
    hostDepth++
    try {
      return run()
    } finally {
      hostDepth--
    }
  }

  /**
   * `changes` to `node` with its position as the policy decides it; every other field as it was.
   * A position the policy refuses is left out, so the layer stays where it is. Callers ask it for
   * moves alone, where the person means to move a layer: a drag, a nudge, a typed X or Y.
   */
  function constrainMove<T extends Partial<SceneNode>>(
    node: SceneNode,
    changes: T,
    preview = false
  ): T {
    if (!policy || hostDepth > 0 || undo.isReplaying) return changes
    if (changes.x === undefined && changes.y === undefined) return changes
    const to: Partial<Vector> = {}
    if (changes.x !== undefined) to.x = changes.x
    if (changes.y !== undefined) to.y = changes.y
    const decided = policy({ node, to, preview }) ?? {}
    const rest: T = { ...changes }
    delete rest.x
    delete rest.y
    if (decided.x !== undefined) rest.x = decided.x
    if (decided.y !== undefined) rest.y = decided.y
    return rest
  }

  return { setMovePolicy, isHostEdit, runAsHost, constrainMove }
}

export type MovePolicyActions = ReturnType<typeof createMovePolicy>
