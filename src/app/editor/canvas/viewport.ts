import { useElementBounding } from '@vueuse/core'
import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue'

import type { Rect } from '@open-pencil/scene-graph/primitives'

const WORKSPACE_VIEWPORT: InjectionKey<ComputedRef<Rect | null>> = Symbol('workspace-viewport')

/** The part of the workspace not covered by its side panels, in window coordinates. */
export function provideWorkspaceViewport(bounds: ComputedRef<Rect | null>) {
  provide(WORKSPACE_VIEWPORT, bounds)
}

/** Navigation uses the visible part of each pane; drawing always uses its whole canvas. */
export function useCanvasViewportBounds(element: Ref<HTMLElement | null>, topInset = () => 0) {
  const workspace = inject(WORKSPACE_VIEWPORT, null)
  const box = useElementBounding(element)
  return computed<Rect>(() => {
    const visible = workspace?.value
    const left = visible ? Math.max(box.left.value, visible.x) : box.left.value
    const right = visible ? Math.min(box.right.value, visible.x + visible.width) : box.right.value
    const top = topInset()
    return {
      x: Math.max(0, left - box.left.value),
      y: top,
      width: Math.max(0, right - left),
      height: Math.max(0, box.height.value - top)
    }
  })
}
