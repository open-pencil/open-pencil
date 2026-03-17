import { type InjectionKey, inject, provide } from 'vue'

import type { SceneNode } from '@open-pencil/core'
import type { Ref } from 'vue'

export interface CanvasContext {
  canvasRef: Ref<HTMLCanvasElement | null>
  ready: Ref<boolean>
  renderNow: () => void
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null
}

export const CANVAS_KEY: InjectionKey<CanvasContext> = Symbol('canvas')

export function provideCanvas(ctx: CanvasContext) {
  provide(CANVAS_KEY, ctx)
}

export function useCanvasContext(): CanvasContext {
  const ctx = inject(CANVAS_KEY)
  if (!ctx) throw new Error('[open-pencil] useCanvasContext() called outside <CanvasRoot>')
  return ctx
}
