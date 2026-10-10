import { editedGradientLayout, type GradientEdit } from '@open-pencil/core/editor'
import { hitTestGradientHandles } from '@open-pencil/core/geometry'

import { useEditorStore } from '@/app/editor/active-store'

type GradientTarget = Omit<GradientEdit, 'stop'>

/**
 * Ties a paint's picker to the canvas gradient handles: while the picker of a single layer's
 * paint is open, the canvas shows that gradient's handles and both share the selected stop.
 */
export function useGradientEditing() {
  const store = useEditorStore()

  function target(
    nodeIds: readonly string[],
    paint: GradientEdit['paint'],
    index: number
  ): GradientTarget | null {
    const [nodeId] = nodeIds
    return nodeIds.length === 1 && nodeId ? { nodeId, paint, index } : null
  }

  function editing(target: GradientTarget | null) {
    const edit = store.state.gradientEdit
    if (!edit || !target) return null
    const same =
      edit.nodeId === target.nodeId && edit.paint === target.paint && edit.index === target.index
    return same ? edit : null
  }

  function setOpen(target: GradientTarget | null, open: boolean) {
    if (open && target) store.state.gradientEdit = { ...target, stop: 0 }
    else if (!open && editing(target)) store.state.gradientEdit = null
    store.requestRepaint()
  }

  function stop(target: GradientTarget | null): number | undefined {
    return editing(target)?.stop
  }

  function setStop(target: GradientTarget | null, stop: number | undefined) {
    const edit = editing(target)
    if (!edit || stop === undefined || edit.stop === stop) return
    store.state.gradientEdit = { ...edit, stop }
    store.requestRepaint()
  }

  /** Whether a press lands on a gradient handle, which must not close the picker. */
  function pressesHandle(event: PointerEvent): boolean {
    const canvas = event.target
    if (!(canvas instanceof HTMLCanvasElement)) return false
    const layout = editedGradientLayout(store.graph, store.state.gradientEdit, store.state)
    if (!layout) return false
    const bounds = canvas.getBoundingClientRect()
    return (
      hitTestGradientHandles(layout, {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top
      }) !== null
    )
  }

  return { target, setOpen, stop, setStop, pressesHandle }
}
