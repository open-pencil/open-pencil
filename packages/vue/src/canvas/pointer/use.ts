import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { canvasToLocalPoint, getPointerCoords, hitTestLayerAt } from '#vue/shared/input/geometry'
import type { HitTestFns } from '#vue/shared/input/select'

export function createCanvasPointer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null,
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null,
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null
) {
  const canvasToLocal = (cx: number, cy: number, scopeId: string) =>
    canvasToLocalPoint(cx, cy, scopeId, editor)
  const hitTestLayer = (cx: number, cy: number, deep: boolean) =>
    hitTestLayerAt(cx, cy, deep, editor)

  const hitFns: HitTestFns = {
    hitTestLayer,
    hitTestSectionTitle,
    hitTestComponentLabel,
    hitTestFrameTitle
  }

  return {
    getCoords: (e: MouseEvent) => getPointerCoords(e, canvasRef.value, editor),
    canvasToLocal,
    hitTestLayer,
    hitFns
  }
}
