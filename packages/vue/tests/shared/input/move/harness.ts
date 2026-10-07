import { createEditor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import { handleMoveMove, handleMoveUp, type MoveModifiers } from '#vue/shared/input/move'
import { createSelectionMoveDrag } from '#vue/shared/input/select/move'
import type { DragMove } from '#vue/shared/input/types'

/** An editor with helpers that replay a canvas move the way pointer input drives it. */
export function createMoveHarness() {
  const editor = createEditor()
  const page = editor.state.currentPageId

  function node(type: SceneNode['type'], parentId: string, props: Partial<SceneNode> = {}) {
    return editor.graph.createNode(type, parentId, { width: 40, height: 40, ...props })
  }

  function drag(
    ids: string[],
    from: [number, number],
    to: [number, number],
    modifiers: MoveModifiers = {},
    during?: (move: DragMove) => void
  ) {
    editor.select(ids)
    const move = createSelectionMoveDrag(from[0], from[1], from[0], from[1], editor, false)
    if (move.type !== 'move') throw new Error('Expected a move drag')
    during?.(move)
    handleMoveMove(move, to[0], to[1], to[0], to[1], editor, modifiers)
    handleMoveUp(move, editor)
  }

  function parentOf(id: string) {
    return editor.graph.getNode(id)?.parentId
  }

  function childIds(id: string) {
    return editor.graph.getChildren(id).map((child) => child.id)
  }

  return { editor, page, node, drag, parentOf, childIds }
}

export type MoveHarness = ReturnType<typeof createMoveHarness>
