import type { Editor } from '@open-pencil/core'
import {
  createSceneGeometry,
  pressesTinyLayer,
  selectionHandleRect
} from '@open-pencil/core/geometry'
import type { SceneNode } from '@open-pencil/scene-graph'

import type { HitTestFns } from '#vue/shared/input/select'

/** The layer whose label is under a point; labels are drawn frames first, so the topmost is first. */
export function hitTestLabel(
  cx: number,
  cy: number,
  fns: Pick<HitTestFns, 'hitTestComponentLabel' | 'hitTestSectionTitle' | 'hitTestFrameTitle'>
): SceneNode | null {
  return (
    fns.hitTestComponentLabel(cx, cy) ??
    fns.hitTestSectionTitle(cx, cy) ??
    fns.hitTestFrameTitle(cx, cy)
  )
}

/** A selected layer too small for handles that takes a press near it, as Figma widens it. */
export function tinySelectionAt(cx: number, cy: number, editor: Editor): SceneNode | null {
  const geometry = createSceneGeometry(editor.graph, editor.state.rotationPreview)
  const zoom = editor.renderer?.zoom ?? 1
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    const point = node && geometry.toLocal(node, { x: cx, y: cy })
    if (node && point && pressesTinyLayer(point, selectionHandleRect(node), zoom)) return node
  }
  return null
}

/** The layer a press selects; `deep` (Cmd or Ctrl held) reaches the deepest layer, as in Figma. */
export function resolveHit(
  cx: number,
  cy: number,
  editor: Editor,
  fns: HitTestFns,
  deep = false
): SceneNode | null {
  const titleHit = hitTestLabel(cx, cy, fns)
  if (titleHit) return titleHit

  const hit = fns.hitTestInScope(cx, cy, deep)
  if (hit) return hit

  const scopeId = editor.state.enteredContainerId
  if (!scopeId) return null

  if (fns.isInsideContainerBounds(cx, cy, scopeId)) {
    editor.clearSelection()
    return null
  }

  editor.exitContainer()
  const afterExit = fns.hitTestInScope(cx, cy, deep)
  if (afterExit) return afterExit

  if (editor.state.enteredContainerId) {
    editor.exitContainer()
  }
  return null
}
