import { type ComputedRef, type InjectionKey, type Ref, inject, provide } from 'vue'

import type { Editor, EditorToolDef, Tool } from '@open-pencil/core'

/** The canvas edges a toolbar can dock to. */
export const TOOLBAR_SIDES = ['top', 'right', 'bottom', 'left'] as const
export type ToolbarSide = (typeof TOOLBAR_SIDES)[number]
export type ToolbarOrientation = 'horizontal' | 'vertical'

/** Where along its edge the toolbar sits: the start is the left or top end. */
export const TOOLBAR_ALIGNS = ['start', 'center', 'end'] as const
export type ToolbarAlign = (typeof TOOLBAR_ALIGNS)[number]

const OPPOSITE_SIDE: Record<ToolbarSide, ToolbarSide> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right'
}

/** A toolbar along the left or right edge stacks its tools vertically. */
export function toolbarOrientation(side: ToolbarSide): ToolbarOrientation {
  return side === 'left' || side === 'right' ? 'vertical' : 'horizontal'
}

/** Menus and tooltips open away from the edge the toolbar is docked to, toward the canvas. */
export function toolbarPopupSide(side: ToolbarSide): ToolbarSide {
  return OPPOSITE_SIDE[side]
}

export interface ToolbarContext {
  editor: Editor
  tools: EditorToolDef[]
  activeTool: ComputedRef<Tool>
  flyoutSelections: ReadonlyMap<Tool, Tool>
  expandedFlyout: Ref<Tool | null>
  /** The edge the toolbar is docked to. */
  side: ComputedRef<ToolbarSide>
  /** `vertical` when docked left or right. */
  orientation: ComputedRef<ToolbarOrientation>
  /** Where along its edge the toolbar sits. */
  align: ComputedRef<ToolbarAlign>
  /** Where flyouts, popovers, and tooltips open: the side opposite the dock. */
  popupSide: ComputedRef<ToolbarSide>
  setTool: (tool: Tool) => void
  setSide: (side: ToolbarSide) => void
  setAlign: (align: ToolbarAlign) => void
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
