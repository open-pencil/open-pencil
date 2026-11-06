import { useEventListener } from '@vueuse/core'

import { gridNudge, resolveEditorProfile } from '@open-pencil/core'
import type { Editor } from '@open-pencil/core'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { OpenOverlays } from '#vue/lifecycle/overlays'

import { isEditing } from './focus'
import { overlayHoldsKeys } from './overlays'
import { isReservedModShortcut } from './reserved'

const NUDGE_DELTAS: Partial<Record<string, [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0]
}

/** The top-left corner on the canvas of the selected layers a nudge moves: the unlocked ones. */
function selectionOrigin(store: Editor): Vector {
  let x = Infinity
  let y = Infinity
  for (const id of store.state.selectedIds) {
    if (store.graph.getNode(id)?.locked) continue
    const position = store.graph.getAbsolutePosition(id)
    x = Math.min(x, position.x)
    y = Math.min(y, position.y)
  }
  return { x, y }
}

/**
 * Arrow keys move the selection: by 1, by 10 with Shift, or onto the profile's snap grid.
 * `heldBack` says when the host keeps the keys, as for another editor on the page.
 */
export function bindNudgeKeys(
  store: Editor,
  overlays: OpenOverlays | undefined,
  heldBack: (event: KeyboardEvent) => boolean = () => false
) {
  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (isEditing(e) || store.state.editingTextId || heldBack(e)) return
    // The browser's own action for a key the editor reserves stays stopped, a preview's included.
    if (isReservedModShortcut(e)) e.preventDefault()
    // A preview runs the design; only the keys that leave it work there.
    if (resolveEditorProfile(store.state).shortcuts === 'view') return
    if (e.metaKey || e.ctrlKey || e.altKey) return

    const delta = NUDGE_DELTAS[e.code]
    if (!delta || store.state.selectedIds.size === 0) return
    if (overlayHoldsKeys(e, overlays)) return

    const [x, y] = delta
    const { snapGrid } = resolveEditorProfile(store.state)
    if (e.shiftKey && snapGrid > 1) {
      const nudge = gridNudge(selectionOrigin(store), { x, y }, snapGrid)
      store.nudgeSelected(nudge.x, nudge.y)
    } else {
      const step = e.shiftKey ? 10 : 1
      store.nudgeSelected(x * step, y * step)
    }
    e.preventDefault()
  })
}
