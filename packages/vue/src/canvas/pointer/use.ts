import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import {
  canvasToLocalPoint,
  getPointerCoords,
  hitTestFrameBorder,
  hitTestInEditorScope,
  isInsideEditorContainerBounds
} from '#vue/shared/input/geometry'
import type { HitTestFns } from '#vue/shared/input/select'

export function createCanvasPointer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null,
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null,
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null,
  hitTestFrameTitles: (cx: number, cy: number) => SceneNode | null
) {
  const canvasToLocal = (cx: number, cy: number, scopeId: string) =>
    canvasToLocalPoint(cx, cy, scopeId, editor)
  const hitTestInScope = (cx: number, cy: number, deep: boolean) =>
    hitTestInEditorScope(cx, cy, deep, editor)
  const isInsideContainerBounds = (cx: number, cy: number, containerId: string) =>
    isInsideEditorContainerBounds(cx, cy, containerId, editor, canvasToLocal)

  const hitFns: HitTestFns = {
    hitTestInScope,
    isInsideContainerBounds,
    hitTestSectionTitle,
    hitTestComponentLabel,
    hitTestFrameTitle,
    hitTestFrameBorder: (cx: number, cy: number) => hitTestFrameBorder(cx, cy, editor),
    hitTestFrameTitles
  }

  return {
    getCoords: (e: MouseEvent) => getPointerCoords(e, canvasRef.value, editor),
    canvasToLocal,
    hitTestInScope,
    isInsideContainerBounds,
    hitFns
  }
}
