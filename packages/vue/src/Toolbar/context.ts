import { type InjectionKey, inject, provide } from 'vue'

import type { Editor, EditorToolDef, Tool } from '@open-pencil/core/editor'
import type { ComputedRef, Ref } from 'vue'

export interface ToolbarContext {
  editor: Editor
  tools: EditorToolDef[]
  activeTool: ComputedRef<Tool>
  expandedFlyout: Ref<Tool | null>
  setTool: (tool: Tool) => void
  toggleFlyout: (tool: Tool) => void
  closeFlyout: () => void
}

export const TOOLBAR_KEY: InjectionKey<ToolbarContext> = Symbol('toolbar')

export function provideToolbar(ctx: ToolbarContext) {
  provide(TOOLBAR_KEY, ctx)
}

export function useToolbar(): ToolbarContext {
  const ctx = inject(TOOLBAR_KEY)
  if (!ctx) throw new Error('[open-pencil] useToolbar() called outside <ToolbarRoot>')
  return ctx
}
