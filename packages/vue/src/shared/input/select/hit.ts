import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import type { HitTestFns } from '#vue/shared/input/select'

/** The layer a press selects; `deep` (Cmd or Ctrl held) reaches the deepest layer, as in Figma. */
export function resolveHit(
  cx: number,
  cy: number,
  editor: Editor,
  fns: HitTestFns,
  deep = false
): SceneNode | null {
  // Labels are drawn frames first, then sections, then components, so the topmost is tested first.
  const titleHit =
    fns.hitTestComponentLabel(cx, cy) ??
    fns.hitTestSectionTitle(cx, cy) ??
    fns.hitTestFrameTitle(cx, cy)
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
