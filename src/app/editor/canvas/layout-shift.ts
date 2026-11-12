import type { EditorStore } from '@/app/editor/active-store'
import { panForCanvasLayout } from '@/app/presence/registry'

type CanvasPaneTarget = { kind: 'active' } | { kind: 'inactive'; paneId: string }

function paneTarget(store: EditorStore, paneId: string | undefined): CanvasPaneTarget {
  if (!paneId || store.activePaneId.value === paneId) {
    return { kind: 'active' }
  }
  return { kind: 'inactive', paneId }
}

export function keepDrawingStillAsCanvasMoves(
  store: EditorStore,
  paneId: string | undefined,
  dx: number,
  dy: number
): void {
  const target = paneTarget(store, paneId)
  if (target.kind === 'active') {
    panForCanvasLayout(store, -dx, -dy)
    return
  }
  const inactivePaneView = store.getPaneView(target.paneId)
  if (!inactivePaneView) {
    return
  }
  inactivePaneView.panX -= dx
  inactivePaneView.panY -= dy
  store.requestRepaint()
}
