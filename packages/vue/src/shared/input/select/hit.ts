import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import type { HitTestFns } from '#vue/shared/input/select'

export function resolveHit(
  cx: number,
  cy: number,
  editor: Editor,
  fns: HitTestFns
): SceneNode | null {
  const titleHit =
    fns.hitTestFrameTitles(cx, cy) ??
    fns.hitTestSectionTitle(cx, cy) ??
    fns.hitTestComponentLabel(cx, cy)
  if (titleHit) return titleHit

  const hit = fns.hitTestInScope(cx, cy, false)
  if (hit) return hit

  const borderHit = fns.hitTestFrameBorder(cx, cy)
  if (borderHit) return borderHit

  const scopeId = editor.state.enteredContainerId
  if (!scopeId) return null

  if (fns.isInsideContainerBounds(cx, cy, scopeId)) {
    editor.clearSelection()
    return null
  }

  editor.exitContainer()
  const afterExit = fns.hitTestInScope(cx, cy, false)
  if (afterExit) return afterExit

  if (editor.state.enteredContainerId) {
    editor.exitContainer()
  }
  return null
}
