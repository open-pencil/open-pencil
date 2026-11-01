import { useEventListener } from '@vueuse/core'

import { gridNudge, resolveEditorProfile } from '@open-pencil/core'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'
import { isEditing } from '@/app/shell/keyboard/focus'
import { isReservedModShortcut } from '@/app/shell/keyboard/reserved'

const NUDGE_DELTAS: Partial<Record<string, [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0]
}

/** The top-left corner on the canvas of the selected layers a nudge moves: the unlocked ones. */
function selectionOrigin(store: EditorStore): Vector {
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

export function bindNudgeKeys(store: EditorStore) {
  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (isEditing(e) || store.state.editingTextId) return
    if (isReservedModShortcut(e)) e.preventDefault()
    if (e.metaKey || e.ctrlKey || e.altKey) return

    const delta = NUDGE_DELTAS[e.code]
    if (!delta || store.state.selectedIds.size === 0) return

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
