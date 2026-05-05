import { inject, provide } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'

import type { SceneNode } from '@open-pencil/core/scene-graph'

import type { useLayout } from '#vue/controls/layout/use'

type RawLayoutControlsContext = ShallowUnwrapRef<ReturnType<typeof useLayout>>
export type LayoutControlsContext = Omit<RawLayoutControlsContext, 'node'> & { node: SceneNode }

const LAYOUT_CONTROLS_KEY: InjectionKey<LayoutControlsContext> = Symbol('LayoutControlsContext')

export function provideLayoutControls(ctx: LayoutControlsContext) {
  provide(LAYOUT_CONTROLS_KEY, ctx)
}

export function useLayoutControlsContext(): LayoutControlsContext {
  const ctx = inject(LAYOUT_CONTROLS_KEY)
  if (!ctx) throw new Error('Layout controls must be used within LayoutControlsRoot')
  return ctx
}
